import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

export function validate(schema: ZodSchema, defaultCode?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const customIssue = result.error.issues.find(
        (issue) => issue.code === "custom"
      );
      const issueCode =
        customIssue &&
        "params" in customIssue &&
        typeof customIssue.params?.errorCode === "string"
          ? customIssue.params.errorCode
          : undefined;

      return res.status(400).json({
        success: false,
        message: "Validation failed",
        ...((issueCode || defaultCode) ? { code: issueCode || defaultCode } : {}),
        errors: result.error.flatten()
      });
    }

    req.body = result.data;
    next();
  };
}
