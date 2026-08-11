import { describe, expect, it } from "vitest";
import { customerAppUrl, customerRouteRedirectUrl } from "./site-urls";

const production = {
  publicWebUrl: "https://www.berylshelter.com",
  customerAppUrl: "https://app.berylshelter.com"
};

describe("customer/public URL routing", () => {
  it("sends public signup and login links to the production customer application", () => {
    expect(customerAppUrl("/signup", production)).toBe("https://app.berylshelter.com/signup");
    expect(customerAppUrl("/login", production)).toBe("https://app.berylshelter.com/login");
  });

  it("keeps preview customer routes on the single preview hostname", () => {
    const preview = { publicWebUrl: "https://dev.berylshelter.com", customerAppUrl: "https://dev.berylshelter.com" };
    expect(customerAppUrl("/signup", preview)).toBe("https://dev.berylshelter.com/signup");
    expect(customerRouteRedirectUrl("https://dev.berylshelter.com/signup", preview)).toBeNull();
  });

  it("redirects production customer routes from the public host only, without loops", () => {
    expect(customerRouteRedirectUrl("https://www.berylshelter.com/login?returnTo=%2Fbuyer", production)).toBe("https://app.berylshelter.com/login?returnTo=%2Fbuyer");
    expect(customerRouteRedirectUrl("https://app.berylshelter.com/login", production)).toBeNull();
  });
});
