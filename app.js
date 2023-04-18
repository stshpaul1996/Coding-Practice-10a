const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SECRETE_KEY", async (error, payload) => {
      if (error) {
        response.send("Invalid Access Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//API-1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = `
    SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(getUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "SECRETE_KEY");
      response.send({ jwtToken: jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API-2
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
    SELECT state_id AS stateId,
    state_name AS stateName,
    population
    FROM state`;
  const getStates = await db.all(getStatesQuery);
  response.send(getStates);
});

//API-3
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
    SELECT state_id AS stateId,
    state_name AS stateName,
    population
    FROM state
     WHERE state_id = '${stateId}'`;
  const getState = await db.get(getStateQuery);
  response.send(getState);
});

//API-4
app.post("/districts/", authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const addDistrictQuery = `
  INSERT INTO district(district_name, state_id, cases, cured, active, deaths)
  VALUES('${districtName}', '${stateId}', '${cases}', '${cured}', 
  '${active}', '${deaths}')`;
  await db.run(addDistrictQuery);

  response.send("District Successfully Added");
});

//API-5
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
    SELECT *
    FROM district 
    WHERE district_id = '${districtId}'`;
    const getDistrict = await db.get(getDistrictQuery);
    const convertSnakeToCamelCase = (each) => {
      return {
        districtId: each.district_id,
        districtName: each.district_name,
        stateId: each.state_id,
        cases: each.cases,
        cured: each.cured,
        active: each.active,
        deaths: each.deaths,
      };
    };
    console.log(getDistrict);
    response.send(convertSnakeToCamelCase(getDistrict));
  }
);

//API-6
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    DELETE FROM district WHERE district_id = '${districtId}'`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//API-7
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const updateDistrictQuery = `
  UPDATE district
  SET district_name = '${districtName}',
  state_id = '${stateId}',
  cases = '${cases}',
  cured = '${cured}',
  active = '${active}',
  deaths = '${deaths}' WHERE district_id = '${districtId}'`;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//API-8
app.get(
  "/states/:stateId/stats",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const statsStatesQuery = `
    SELECT SUM(cases) AS totalCases, SUM(cured) AS totalCured, 
    SUM(active) AS totalActive, SUM(deaths) AS totalDeaths
    FROM district WHERE state_id = '${stateId}'`;
    const getStatsState = await db.get(statsStatesQuery);
    response.send(getStatsState);
  }
);

module.exports = app;
