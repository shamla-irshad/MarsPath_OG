import unittest
from fastapi import HTTPException
from main import RouteRequest, generate_routes, candidate_records

class ScienceStopTests(unittest.TestCase):
    def test_order_and_metrics(self):
        records = {c['id']: c for c in candidate_records()}
        end = records['JEZERO_C']['localGridPoint']
        response = generate_routes(RouteRequest(destination=end, candidateId='JEZERO_C', scienceStopIds=['JEZERO_A','JEZERO_B']))
        self.assertEqual(len(response['routes']), 3)
        for route in response['routes']:
            points = route['geometry']
            first = points.index(records['JEZERO_A']['localGridPoint'])
            second = points.index(records['JEZERO_B']['localGridPoint'], first)
            self.assertGreater(second, first)
            self.assertEqual(points[-1], end)
            self.assertEqual(len(route['legs']), 3)
            self.assertAlmostEqual(sum(l['distanceMeters'] for l in route['legs']), route['metrics']['distanceMeters'], delta=.04)

    def test_invalid_stops(self):
        end = next(c for c in candidate_records() if c['id']=='JEZERO_C')['localGridPoint']
        for ids in [['LIFE_001'], ['JEZERO_A','JEZERO_A'], ['JEZERO_C']]:
            with self.assertRaises(HTTPException) as raised:
                generate_routes(RouteRequest(destination=end, candidateId='JEZERO_C', scienceStopIds=ids))
            self.assertEqual(raised.exception.status_code,422)
