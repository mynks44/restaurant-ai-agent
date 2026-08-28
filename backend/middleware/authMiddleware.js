import { firebaseAuth } from "../firebaseAdmin.js";

async function decodeAuthorizationHeader(req) {
  const authorization = req.headers.authorization || "";

  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.substring(7).trim();

  if (!token) {
    return null;
  }

  return firebaseAuth.verifyIdToken(token);
}

export async function requireAuth(req, res, next) {
  try {
    const decodedToken = await decodeAuthorizationHeader(req);

    if (!decodedToken) {
      return res.status(401).json({
        error: "Please sign in to continue."
      });
    }

    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Authentication error:", error);

    res.status(401).json({
      error: "Your login session is invalid or expired."
    });
  }
}

export async function optionalAuth(req, res, next) {
  try {
    req.user = await decodeAuthorizationHeader(req);
  } catch {
    req.user = null;
  }

  next();
}