import jwt from 'jsonwebtoken';

export const verifyToken = (req, res, next) => {
	// const token = req.headers.authorization?.split(' ')[1];
	const token = req.cookies["token"];

	if (!token) {
		return res.status(401).json({ message: "Access token is missing or invalid" });
	}

	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		req.userId = decoded.id;
		next();
	} catch (error) {
		res.status(403).json({ message: "Invalid token" });
	}
};
