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
  // params is an object we'll pass to our handlebars template
  let params = { seo: seo };

  // If someone clicked the option for a random color it'll be passed in the querystring
  if (request.query.randomize) {
    // We need to load our color data file, pick one at random, and add it to the params
    const colors = require("./src/colors.json");
    const allColors = Object.keys(colors);
    let currentColor = allColors[(allColors.length * Math.random()) << 0];

    // Add the color properties to the params object
    params = {
      color: colors[currentColor],
      colorError: null,
      seo: seo,
    };
  }

  // The Handlebars code will be able to access the parameter values and build them into the page
  return reply.view("/src/pages/index.hbs", params);
});

fastify.post("/", function (request, reply) {
  // Build the params object to pass to the template
  let params = { seo: seo };

  const deleteConfirmation = request.body.delete;

  let color = request.body.color;
  const formEntries = request.body;
  const nameEntry = formEntries.name.trim();

  if (!nameEntry) {
    params.error = "Search input is missing or invalid.";
    return reply.view("/src/pages/index.hbs", params);
  }

  getLeaderboards(formEntries.appid, formEntries.key).then((response) => {
    if (response.error) {
      console.log({ err: response.error });
      const cleanedText = response.error.data.replace(/<\/?[^>]+(>|$)/g, "");
      params.error = cleanedText;
      return reply.view("/src/pages/index.hbs", params);
    }
    const data = response.response.data.response.leaderboards;
    const filteredLeaderboards = FilterLeaderboards(data, nameEntry);
    if(filteredLeaderboards.length <= 0){
      params.error = "Search input returned no results.";
      return reply.view("/src/pages/index.hbs", params);
    }
    params.leaderboards = filteredLeaderboards;
    console.log({LB: params.leaderboards});
    return reply.view("/src/pages/index.hbs", params);
  });
});

// Run the server and report out to the logs
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

async function deleteLeaderboard(appid = "", key = "", name = "") {
  if (!appid || !key || !name) return;
  var formdata = new FormData();
  formdata.append("key", "B4C158613225C0FD6B1BA6F138FC6D32");
  formdata.append("appid", "1968730");
  formdata.append("name", name ? name : "z_duo_2022.10.1_beta");

  var requestOptions = {
    method: "POST",
    body: formdata,
    redirect: "follow",
  };

  const url = `${steamworksUrl}${deleteLeaderboardUrl}`;

  const response = await fetch(
    `${url}?appid=${appid}&key=${key}&name=${name}`,
    requestOptions
  );
  return response.json();
}

function FilterLeaderboards(leaderboards, searchInput){
  const regex = new RegExp(`${searchInput}`, "i");
  
  const filteredLeaderboards = leaderboards.filter(leaderboard => regex.test(leaderboard.name));
  
  return filteredLeaderboards;
}
