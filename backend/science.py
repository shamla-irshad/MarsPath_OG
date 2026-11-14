"""Read-only scientific context endpoints.

These resources MUST NOT be represented as live Jezero/EVA conditions.  Surface
photography is not matched to route waypoints unless the GIS team verifies it.
"""
from __future__ import annotations

import json
import math
import re
from functools import lru_cache
from pathlib import Path
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field, HttpUrl, field_validator, model_validator

router = APIRouter()
SCIENCE_DIR = Path(__file__).resolve().parent / 'data' / 'science'


class SurfaceImage(BaseModel):
    id: str
    missionId: Literal['rover-navigation-jezero', 'past-life-jezero']
    title: str
    mission: str
    instrument: str
    sol: int = Field(ge=0)
    observationDate: str
    productId: str
    location: str
    imageUrl: HttpUrl
    sourceUrl: HttpUrl
    credit: str
    matchLevel: Literal['regional_context', 'nearby_verified', 'site_verified']
    matchedCandidateIds: list[str] = Field(default_factory=list)
    note: str

    @model_validator(mode='after')
    def verify_match_claim(self):
        if self.matchLevel == 'site_verified' and not self.matchedCandidateIds:
            raise ValueError('A site-verified image must name a verified candidate')
        if self.matchLevel == 'regional_context' and self.matchedCandidateIds:
            raise ValueError('Regional context imagery cannot claim candidate matching')
        return self


class EnvironmentalObservation(BaseModel):
    id: str
    metric: Literal['air_temperature', 'ground_temperature', 'pressure', 'wind_speed', 'ionizing_radiation_dose_rate']
    value: float
    unit: str
    mission: str
    instrument: str
    location: str
    sol: int | None = Field(default=None, ge=0)
    observationDate: str
    productId: str
    sourceUrl: HttpUrl
    contextualOnly: Literal[True] = True

    @field_validator('value')
    @classmethod
    def finite_value(cls, v: float):
        if not math.isfinite(v):
            raise ValueError('An environmental reading must be finite')
        return v

    @model_validator(mode='after')
    def check_instrument_context(self):
        # Prevent common but scientifically misleading site/instrument conflation.
        if self.metric == 'ionizing_radiation_dose_rate':
            instrument = self.instrument.upper()
            mission = self.mission.upper()
            if not re.search(r'\bRAD\b', instrument) or not ('MSL' in mission or 'CURIOSITY' in mission):
                raise ValueError('MSL ionizing dose values require the Curiosity/MSL RAD instrument, not MEDA RDS')
        return self


def read_json(name: str) -> dict:
    with (SCIENCE_DIR / name).open(encoding='utf-8') as src:
        return json.load(src)


@router.get('/api/science/surface-images')
def surface_images():
    images = [SurfaceImage.model_validate(x) for x in read_json('surface_images.json')['images']]
    return {
        'images': [image.model_dump(mode='json') for image in images],
        'matchingPolicy': 'regional_context is NOT an image of the selected destination. Site matches require separately verified GIS evidence.',
    }


@router.get('/api/environment/observations')
def environment_observations():
    observations = [EnvironmentalObservation.model_validate(x) for x in read_json('environment_observations.json')['observations']]
    return {
        'observations': [observation.model_dump(mode='json') for observation in observations],
        'status': 'historical_context_only' if observations else 'no_observations_uploaded',
        'isLive': False,
        'warning': 'No live EVA conditions, radiation dose prediction, or site-specific safety clearance is available.',
        'references': [
            {'instrument': 'Mars 2020 MEDA', 'site': 'Jezero rover locations', 'url': 'https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/meda.html', 'note': 'Weather observations; its radiation/dust sensor is not an ionizing particle dosimeter.'},
            {'instrument': 'MSL RAD', 'site': 'Gale Crater', 'url': 'https://pds-geosciences.wustl.edu/missions/msl/', 'note': 'Ionizing radiation historical context measured at Gale, NOT Jezero.'},
        ],
    }
