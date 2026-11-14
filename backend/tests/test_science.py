import unittest
from fastapi.testclient import TestClient
from main import app
from science import SurfaceImage, EnvironmentalObservation
from pydantic import ValidationError

class ScientificContextTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_photo_has_provenance_but_not_waypoint_claim(self):
        result = self.client.get('/api/science/surface-images')
        self.assertEqual(result.status_code, 200)
        images = result.json()['images']
        self.assertEqual(images[0]['productId'], 'PIA23727')
        self.assertEqual(images[0]['sol'], 4)
        self.assertEqual(images[0]['matchLevel'], 'regional_context')
        self.assertEqual(images[0]['matchedCandidateIds'], [])

    def test_environment_returns_no_invented_readings(self):
        result = self.client.get('/api/environment/observations')
        self.assertEqual(result.status_code, 200)
        self.assertFalse(result.json()['isLive'])
        self.assertEqual(result.json()['status'], 'no_observations_uploaded')
        self.assertEqual(result.json()['observations'], [])

    def test_site_match_needs_verified_candidate(self):
        sample = self.client.get('/api/science/surface-images').json()['images'][0]
        sample['matchLevel']='site_verified'
        with self.assertRaises(ValidationError):
            SurfaceImage.model_validate(sample)

    def test_radiation_reading_requires_dosimetry_instrument(self):
        with self.assertRaises(ValidationError):
            EnvironmentalObservation.model_validate({
                'id':'incorrect-rds','metric':'ionizing_radiation_dose_rate',
                'value':1.0,'unit':'mGy/day','mission':'Mars 2020','instrument':'MEDA RDS',
                'location':'Jezero','observationDate':'2021-03-01',
                'productId':'placeholder','sourceUrl':'https://science.nasa.gov/',
                'contextualOnly':True
            })

if __name__ == '__main__':
    unittest.main()
