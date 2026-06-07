import serverless from "serverless-http";
import { createServer } from "./index";

const app = createServer();

export default serverless(app);
