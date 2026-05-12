const express = require('express');
const { State, City } = require('country-state-city');

const router = express.Router();

router.get('/states/:countryCode', (req, res) => {
  const states = State.getStatesOfCountry(req.params.countryCode);
  res.json(states.map(s => ({ name: s.name, isoCode: s.isoCode })));
});

router.get('/cities/:countryCode/:stateCode', (req, res) => {
  const cities = City.getCitiesOfState(req.params.countryCode, req.params.stateCode);
  res.json(cities.map(c => c.name));
});

module.exports = router;
