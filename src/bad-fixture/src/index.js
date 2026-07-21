// TODO: implement proper error handling
function processData(data) {
  // FIXME: this is slow
  return data.map(x => x * 2);
}

// TODO: add validation
const config = {
  apiKey: "sk-1234567890abcdef1234567890abcdef",
  debug: true,
};

function handleRequest(req, res) {
  eval(req.body.code); // unsafe
  res.setHeader("Access-Control-Allow-Origin", "*");
}

function insecureFetch(url) {
  return fetch(url); // no timeout
}

function doSomething() {
  // This function is not implemented yet
  throw new Error("Not implemented");
}

function emptyFunc() {

}

// commented out code block
// function oldApproach() {
//   const result = doSomething();
//   return result;
// }
// function oldApproach2() {
//   const result = doSomethingElse();
//   return result;
// }
