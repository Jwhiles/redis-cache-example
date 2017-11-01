// require the dependencies we installed
const app = require("express")();
const responseTime = require("response-time");
const axios = require("axios");
const redis = require("redis");

// create a new redis client and connect to our local redis instance
const client = redis.createClient();

// if an error occurs, print it to the console
client.on("error", err => {
  console.log("Error " + err);
});

app.set("port", process.env.PORT || 5000);

// set up the response-time middleware
app.use(responseTime());

// if a user visits /api/facebook, return the total number of stars 'facebook'
// has across all it's public repositories on GitHub
app.get("/api/:username", (req, res) => {
  const username = req.params.username;
  client.get(username, (err, result) => {
    if (result) {
      res.send({ totalStars: result, source: "redis cache" });
    } else {
      getUserRepositories(username)
        .then(computeTotalStars)
        .then(totalStars => {
          client.setex(username, 60, totalStars);
          res.send({ totalStars: totalStars, source: "GitHub API" });
        })
        .catch(response => {
          if (response.status === 404) {
            res.send("the github username could not be found");
          } else {
            res.send(response);
          }
        });
    }
  });
});

app.listen(app.get("port"), () => {
  console.log("Server listening on port: ", app.get("port"));
});

// call the GitHub API to fetch information about the user's repositories
const getUserRepositories = user => {
  const githubEndpoint =
    "https://api.github.com/users/" + user + "/repos" + "?per_page=100";
  return axios.get(githubEndpoint);
};

// add up all the stars and return the total number of stars across all repositories
const computeTotalStars = repositories => {
  return repositories.data.reduce(function(prev, curr) {
    return prev + curr.stargazers_count;
  }, 0);
};
