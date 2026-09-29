import { apiClient } from "./api-client";
import { createPropertiesApi } from "./properties-api-core";

export { propertyQuery } from "./properties-api-core";
export const propertiesApi = createPropertiesApi(apiClient);
