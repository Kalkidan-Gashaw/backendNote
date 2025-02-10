const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  console.log("Incoming token:", token); // Log the incoming token

  if (!token) {
    console.error("No token provided."); // Log if no token is provided
    return res.status(401).json({ error: true, message: "No token provided." }); // Unauthorized
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) {
      console.error("Token verification error:", err); // Log error
      return res
        .status(403)
        .json({ error: true, message: "Token verification failed." }); // Forbidden
    }

    console.log("Authenticated user:", user); // Log the authenticated user
    req.user = user; // Attach user info to req object
    next();
  });
}

module.exports = {
  authenticateToken,
};
