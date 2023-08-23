/**
 * This is the main Node.js server script for your project
 * Check out the two endpoints this back-end API provides in fastify.get and fastify.post below
 */

const steamworksUrl = "https://partner.steam-api.com/ISteamLeaderboards";
const getLeaderboardsUrl = "/GetLeaderboardsForGame/v2/";
const deleteLeaderboardUrl = "/DeleteLeaderboard/v1/";

const path = require("path");
const axios = require("axios");

// Require the fastify framework and instantiate it
const fastify = require("fastify")({
  // Set this to true for detailed logging:
  logger: false,
});

// ADD FAVORITES ARRAY VARIABLE FROM TODO HERE

// Setup our static files
fastify.register(require("@fastify/static"), {
  root: path.join(__dirname, "public"),
  prefix: "/", // optional: default '/'
});

// Formbody lets us parse incoming forms
fastify.register(require("@fastify/formbody"));

// View is a templating manager for fastify
fastify.register(require("@fastify/view"), {
  engine: {
    handlebars: require("handlebars"),
  },
});

// Load and parse SEO data
const seo = require("./src/seo.json");
if (seo.url === "glitch-default") {
  seo.url = `https://${process.env.PROJECT_DOMAIN}.glitch.me`;
}

fastify.get("/", function (request, reply) {
  let params = { seo: seo };
  return reply.view("/src/pages/index.hbs", params);
});

fastify.post("/", function (request, reply) {
  let params = { seo: seo };

  const formEntries = request.body;
  const deleteConfirmation = request.body.delete;

  if (deleteConfirmation) {
    const responseData = {};
    let leaderboards = formEntries.leaderboards;
    let appid = formEntries.appid;
    let key = formEntries.key;

    DeleteLeaderboards(appid, key, leaderboards)
      .then((result) => {
        console.log({ axiosAllResponse: result });
        result.map((value) => {
          if (value.status != 200) {
            params.error = value.statusText;
          } else {
            params.success = value.statusText;
          }
          params.data = value.data;
        });
      })
      .catch((err) => {
        console.log({ afterDeleteError: err });
        params.error = err;
      })
      .finally((res) => {
        console.log({ params });
        return reply.view("/src/pages/index.hbs", params);
      });
  } else {
    let color = request.body.color;
    const nameEntry = formEntries.name.trim();

    if (!nameEntry) {
      params.error = "Search input is missing or invalid.";
      return reply.view("/src/pages/index.hbs", params);
    }

    getLeaderboards(formEntries.appid, formEntries.key).then((response) => {
      if (response.error) {
        console.log({ axiosGETError: response.error });
        const cleanedText = response.error.data.replace(/<\/?[^>]+(>|$)/g, "");
        params.error = cleanedText;
        return reply.view("/src/pages/index.hbs", params);
      }
      const data = response.response.data.response.leaderboards;
      const filteredLeaderboards = FilterLeaderboards(data, nameEntry);
      if (filteredLeaderboards.length <= 0) {
        params.error = "Search input returned no results.";
        return reply.view("/src/pages/index.hbs", params);
      }
      params.leaderboards = filteredLeaderboards;
      params.form = {
        appid: formEntries.appid,
        key: formEntries.key,
        name: formEntries.name,
      };
      
      return reply.view("/src/pages/index.hbs", params);
    });
  }
});

fastify.listen(
  { port: process.env.PORT, host: "0.0.0.0" },
  function (err, address) {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Your app is listening on ${address}`);
  }
);

async function getLeaderboards(appid, key) {
  const url = `${steamworksUrl}${getLeaderboardsUrl}`;
  const data = {};

  const response = await axios
    .get(`${url}?appid=${appid}&key=${key}`)
    .catch(function (error) {
      data.error = error.response;
    });
  data.response = response;
  return data;
}

async function DeleteLeaderboards(appid, key, names) {
  const url = `${steamworksUrl}${deleteLeaderboardUrl}`;
  const data = {};

  let axiosRequests = [];
  let namesArray = names.split(",").filter((str) => String(str).trim());

  namesArray.map((name) => {
    const request = axios.post(
      `${url}`,
      `appid=${appid}&key=${key}&name=${name}`
    );
    axiosRequests.push(request);
  });
  const response = {};
  const res = await axios.all(axiosRequests);
  return res;
}

function FilterLeaderboards(leaderboards, searchInput) {
  const regex = new RegExp(`${searchInput}`, "i");

  const filteredLeaderboards = leaderboards.filter((leaderboard) =>
    regex.test(leaderboard.name)
  );

  return filteredLeaderboards;
}
