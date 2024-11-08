# CollabSphere Backend

This is the backend for the CollabSphere project, built using Express and MongoDB. This server handles user authentication, session management, and provides APIs for the frontend.

## Environment Variables

To run the backend properly, create `.env` and `.env.test` files in the root directory of the project with the following variables:

```plaintext
MONGODB_URI=
JWT_SECRET=
```

### Install dependencies:
```bash
npm install
```

### Start the Server
```bash
npm run start
```

### Run Auth Tests
```bash
npm run test:auth
```

### Run Session Tests
```bash
npm run test:session
```