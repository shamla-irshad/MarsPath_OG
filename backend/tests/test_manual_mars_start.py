"""Tests for the two allowed route-start options, using bundled NASA-derived grid."""
import math
import unittest

from fastapi.testclient import TestClient
from main import MARS_RADIUS_M, app, candidate_records, grid_data, point_to_mars_xy


def coords_for_cell(row: int, col: int) -> dict:
    xy = point_to_mars_xy(row, col)
    return {"latNorth": math.degrees(xy["y"] / MARS_RADIUS_M),
            "lonEast": math.degrees(xy["x"] / MARS_RADIUS_M)}


class ManualMarsStartTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_butler_mode_is_default_and_explicit(self):
        destination = {"row": 210, "col": 215}
        for extra in ({}, {"startMode": "butler"}):
            response = self.client.post('/api/routes/generate', json={"missionId": "rover-navigation-jezero", "destination": destination, **extra})
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.json()['start'], {"row": 200, "col": 200})
            self.assertEqual(response.json()['startMode'], 'butler')

    def test_manual_coords_snap_to_containing_cell_and_route(self):
        coords = coords_for_cell(210, 200)
        result = self.client.post('/api/mars/resolve-start', json=coords)
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(result.json()['start'], {'row': 210, 'col': 200})
        self.assertAlmostEqual(result.json()['snapDistanceMeters'], 0, delta=.03)
        request = {"missionId": "rover-navigation-jezero", "startMode": "manual", "startCoordinates": coords,
                   "destination": {"row": 210, "col": 215}}
        routed = self.client.post('/api/routes/generate', json=request)
        self.assertEqual(routed.status_code, 200, routed.text)
        self.assertEqual(routed.json()['startMode'], 'manual')
        self.assertEqual(routed.json()['start'], {'row': 210, 'col': 200})
        self.assertIsNone(routed.json()['candidateId'])
        for route in routed.json()['routes']:
            self.assertEqual(route['geometry'][0], {'row': 210, 'col': 200})
            self.assertEqual(route['geometry'][-1], {'row': 210, 'col': 215})

    def test_manual_coords_work_with_jezero_a_b_c(self):
        coords = coords_for_cell(210, 200)
        for c in candidate_records():
            if c['missionId'] != 'rover-navigation-jezero':
                continue
            resp = self.client.post('/api/routes/generate', json={
                'missionId':'rover-navigation-jezero', 'startMode':'manual',
                'startCoordinates':coords, 'candidateId':c['id'], 'destination':c['localGridPoint']})
            self.assertEqual(resp.status_code, 200, (c['id'], resp.text))
            self.assertEqual(resp.json()['start'], {'row': 210, 'col': 200})
            self.assertEqual(resp.json()['candidateId'], c['id'])

    def test_outside_and_bad_coords_are_rejected(self):
        for coords in ({'latNorth':0.0,'lonEast':0.0}, {'latNorth':18.4,'lonEast':170.0}):
            response=self.client.post('/api/mars/resolve-start',json=coords)
            self.assertEqual(response.status_code,422,response.text)
            self.assertEqual(response.json()['detail']['code'],'OUTSIDE_LOCAL_JEZERO_GRID')
        for coords in ({'latNorth':100,'lonEast':77.45}, {'latNorth':18.44,'lonEast':-77.45}, {'latNorth':18.44,'lonEast':360}):
            self.assertEqual(self.client.post('/api/mars/resolve-start',json=coords).status_code,422)

    def test_blocked_manual_start_is_rejected(self):
        blocked=next((r,c) for r,row in enumerate(grid_data()['costs']) for c,cost in enumerate(row) if cost==255)
        coords=coords_for_cell(*blocked)
        result=self.client.post('/api/mars/resolve-start',json=coords)
        self.assertEqual(result.status_code,422,result.text)
        self.assertEqual(result.json()['detail']['code'],'BLOCKED_CELL')

    def test_reject_conflicting_manual_inputs_and_identical_points(self):
        coords=coords_for_cell(210,200)
        base={'missionId':'rover-navigation-jezero','destination':{'row':210,'col':215}}
        bad=[{**base,'startMode':'manual'},
             {**base,'startMode':'butler','startCoordinates':coords},
             {**base,'startMode':'manual','startCoordinates':coords,'start':{'row':200,'col':200}},
             {**base,'startMode':'butler','start':{'row':210,'col':200}}]
        for item in bad:self.assertEqual(self.client.post('/api/routes/generate',json=item).status_code,422)
        response=self.client.post('/api/routes/generate',json={**base,'startMode':'manual','startCoordinates':coords,
                                                       'destination':{'row':210,'col':200}})
        self.assertEqual(response.status_code,422)
        self.assertEqual(response.json()['detail']['code'],'SAME_POINT')

    def test_other_two_missions_remain_science_only(self):
        for mission in ('water-ice-arcadia','past-life-jezero'):
            r=self.client.post('/api/routes/generate',json={
                'missionId':mission,'startMode':'manual','startCoordinates':coords_for_cell(210,200),
                'destination':{'row':210,'col':215}})
            self.assertEqual(r.status_code,422)
            self.assertEqual(r.json()['detail']['code'],'ROUTING_UNAVAILABLE')


if __name__ == '__main__': unittest.main()
