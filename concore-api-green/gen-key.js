const jwt = require("jsonwebtoken");

const secret = "super-secret-jwt-token-super-secret-jwt-token";

const token = jwt.sign(
  {
    role: "service_role"
  },
  secret
);

console.log(token);
