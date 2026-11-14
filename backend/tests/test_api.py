import unittest
from fastapi.testclient import TestClient
from main import app, astar, grid_data

class MarsPathAPITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_health_and_six_page_data(self):
        health = self.client.get('/api/health')
        self.assertEqual(health.status_code, 200)
        self.assertEqual(health.json()['candidateCount'], 9)
        for mission in ('rover-navigation-jezero', 'water-ice-arcadia', 'past-life-jezero'):
            response = self.client.get(f'/api/missions/{mission}/candidates')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(len(response.json()['candidates']), 3)

    def test_routes_use_real_grid_and_both_objectives(self):
        for target in ((56, 370), (59, 81), (110, 350)):
            response = self.client.post('/api/routes/generate', json={"destination": {"row": target[0], "col": target[1]}, "missionId": "rover-navigation-jezero"})
            self.assertEqual(response.status_code, 200, response.text)
            routes = response.json()['routes']
            self.assertEqual([r['id'] for r in routes], ['shortest', 'lower', 'balanced'])
            for route in routes:
                self.assertEqual(route['geometry'][0], {"row": 200, "col": 200})
                self.assertEqual(route['geometry'][-1], {"row": target[0], "col": target[1]})
                self.assertGreater(route['metrics']['distanceMeters'], 0)
            costs=grid_data()['costs']
            for item in routes:
                geometry=item['geometry']
                for a,b in zip(geometry,geometry[1:]):
                    dr,dc=b['row']-a['row'],b['col']-a['col']
                    self.assertLessEqual(max(abs(dr),abs(dc)),1)
                    self.assertGreater(abs(dr)+abs(dc),0)
                    self.assertIn(costs[b['row']][b['col']],(1,5))
                    if dr and dc:
                        self.assertIn(costs[a['row']+dr][a['col']],(1,5))
                        self.assertIn(costs[a['row']][a['col']+dc],(1,5))
            self.assertLessEqual(routes[0]['metrics']['distanceMeters'], routes[1]['metrics']['distanceMeters'] + .1)
            self.assertLessEqual(routes[1]['metrics']['traversalCost'], routes[0]['metrics']['traversalCost'] + .1)

    def test_blocked_and_unsupported(self):
        blocked = next((r,c) for r,row in enumerate(grid_data()['costs']) for c,v in enumerate(row) if v == 255)
        request = {'missionId':'rover-navigation-jezero','destination':{'row':blocked[0],'col':blocked[1]}}
        self.assertEqual(self.client.post('/api/routes/generate', json=request).status_code,422)
        request['missionId']='water-ice-arcadia'
        self.assertEqual(self.client.post('/api/routes/generate', json=request).status_code,422)

    def test_tapped_custom_jezero_cells_without_candidate_id(self):
        # A map tap is a local grid point, NOT a named science candidate.
        # The endpoint must return a real route for any reachable traversable cell.
        for row, col in ((210,215),(250,220),(80,250)):
            result=self.client.post('/api/routes/generate',json={
                'missionId':'rover-navigation-jezero',
                'destination':{'row':row,'col':col},
                'candidateId':None,
            })
            self.assertEqual(result.status_code,200,result.text)
            self.assertIsNone(result.json()['candidateId'])
            self.assertEqual(len(result.json()['routes']),3)
            for option in result.json()['routes']:
                self.assertEqual(option['geometry'][0],{'row':200,'col':200})
                self.assertEqual(option['geometry'][-1],{'row':row,'col':col})
        self.assertEqual(self.client.post('/api/routes/generate',json={
            'missionId':'rover-navigation-jezero','destination':{'row':200,'col':200}
        }).status_code,422)  # start is not a destination
        self.assertEqual(self.client.post('/api/routes/generate',json={
            'missionId':'rover-navigation-jezero','destination':{'row':0,'col':0}
        }).status_code,422)  # blocked grid cell

    def test_deviation(self):
        line=[{'row':200,'col':200},{'row':200,'col':220}]
        on=self.client.post('/api/navigation/deviation',json={'position':{'row':200,'col':210},'route':line}).json()
        off=self.client.post('/api/navigation/deviation',json={'position':{'row':220,'col':210},'route':line}).json()
        self.assertFalse(on['offRoute'])
        self.assertTrue(off['offRoute'])

    def test_balanced_route_includes_slope_return_and_resource_assessment(self):
        response = self.client.post('/api/routes/generate', json={
            'missionId': 'rover-navigation-jezero',
            'destination': {'row': 230, 'col': 240},
            'evaBudgetMinutes': 90,
            'scienceStopMinutes': 12,
            'returnReserveMinutes': 20,
        })
        self.assertEqual(response.status_code, 200, response.text)
        routes = {route['id']: route for route in response.json()['routes']}
        self.assertEqual(set(routes), {'shortest', 'lower', 'balanced'})
        balanced = routes['balanced']
        self.assertIsNotNone(balanced['metrics']['maximumSlopeDegrees'])
        self.assertIn('unknownSlopeDistanceMeters', balanced['metrics'])
        self.assertGreater(balanced['returnRoute']['metrics']['distanceMeters'], 0)
        assessment = balanced['resourceAssessment']
        self.assertEqual(assessment['returnReserveMinutes'], 20)
        self.assertGreater(assessment['estimatedRoundTripMinutes'], assessment['outboundMinutes'])
        self.assertIn(assessment['status'], ('within illustrative budget', 'exceeds illustrative budget'))

if __name__=='__main__':
    unittest.main()

