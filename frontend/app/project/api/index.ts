import serverless from "serverless-http";
import { createServer } from "../dist/serverless/handler.mjs";

const app = createServer();

export default serverless(app);
