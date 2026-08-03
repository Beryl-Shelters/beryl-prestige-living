import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import routes from "./routes";
import { errorMiddleware } from "./middlewares/error.middleware";
import { env } from "./config/env";
import { swaggerSpec } from "./config/swagger";

const app = express();

app.set("trust proxy", 1);

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec as swaggerUi.JsonObject, {
    customSiteTitle: "Beryl Shelter API Docs",
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: "list",
      filter: true,
      tagsSorter: "alpha",
      operationsSorter: "alpha"
    }
  })
);

app.get("/api-docs.json", (_req: Request, res: Response) => {
  res.status(200).json(swaggerSpec);
});

app.use(helmet());

app.use(
  cors({
    origin: [env.clientWebUrl, env.clientMobileUrl].filter(Boolean),
    credentials: true
  })
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many requests, please try again later"
    }
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Beryl Shelter Nigeria Limited API is running"
  });
});

app.use("/api/v1", routes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

app.use(errorMiddleware);

export default app;
