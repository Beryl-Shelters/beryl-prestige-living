"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { submitCareerApplication } from "../../lib/careers-api";
import { careerPositions } from "../../lib/career-positions";
import { PublicHeader } from "../auth/public-header";
import { PublicSiteFooter } from "./public-site-footer";

export function CareersPage() {
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "failure"
  >("idle");
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;
    const form = event.currentTarget;
    const data = new FormData(form);
    if (
      !careerPositions.includes(
        data.get("position") as (typeof careerPositions)[number],
      )
    ) {
      setStatus("failure");
      setError("Select a role before submitting.");
      return;
    }
    setStatus("submitting");
    setError("");
    try {
      await submitCareerApplication(data);
      form.reset();
      setStatus("success");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Your application could not be submitted. Please try again.",
      );
      setStatus("failure");
    }
  }
  return (
    <div className="public-page careers-page">
      <PublicHeader sessionAware mobileMenu />
      <main>
        <section className="careers-hero">
          <div className="careers-hero-inner">
            <div>
              <b>CAREERS</b>
              <h1>
                Join the Beryl
                <br />
                Shelter Team
              </h1>
              <p>
                We are looking for driven, innovative, and passionate
                individuals to help us redefine luxury real estate. Discover
                open roles and build your career with us.
              </p>
            </div>
            <Image
              src="/careers/careers-hero.png"
              alt="Beryl Shelter Nigeria Limited team collaborating"
              width={669}
              height={608}
            />
          </div>
        </section>
        <section className="career-application">
          <div className="career-application-inner">
            <header>
              <h2>
                Apply for an
                <br />
                Open Position
              </h2>
              <p>
                Ready to take the next step in your career? Fill out the form
                with your details, select the role you are interested in, and
                attach your latest resume. Our hiring team will review your
                application and get back to you if your profile matches our
                current needs.
              </p>
            </header>
            <form onSubmit={(event) => void submit(event)}>
              <div className="career-fields">
                <label>
                  Full Name <span>*</span>
                  <input
                    required
                    maxLength={120}
                    name="fullName"
                    autoComplete="name"
                    placeholder="Enter your full name"
                  />
                </label>
                <label>
                  Email Address <span>*</span>
                  <input
                    required
                    type="email"
                    maxLength={254}
                    name="email"
                    autoComplete="email"
                    placeholder="Enter your email address"
                  />
                </label>
                <label>
                  Phone Number <span>*</span>
                  <input
                    required
                    type="tel"
                    maxLength={25}
                    name="phone"
                    autoComplete="tel"
                    placeholder="Enter your phone number"
                  />
                </label>
                <label>
                  Position Applied For <span>*</span>
                  <select required name="position" defaultValue="">
                    <option value="">Select a role</option>
                    {careerPositions.map((position) => (
                      <option key={position} value={position}>
                        {position}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="resume-field">
                Upload Resume/CV <span>*</span>
                <span className="resume-control">
                  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2.5h8l5 5V21H6a2 2 0 0 1-2-2V4.5a2 2 0 0 1 2-2Z" />
                    <path d="M14 2.5V8h5M8 12h8M8 16h8" />
                  </svg>
                  <strong>Choose File</strong>
                  <input
                    required
                    type="file"
                    name="resume"
                    accept=".pdf,application/pdf"
                  />
                </span>
              </label>
              <label className="cover-field">
                Cover Letter / Additional Notes
                <textarea
                  name="coverLetter"
                  maxLength={3000}
                  placeholder="Tell us a little about yourself"
                />
              </label>
              <button type="submit" disabled={status === "submitting"}>
                {status === "submitting"
                  ? "Submitting application…"
                  : "Submit Application"}
              </button>
              {status === "success" && (
                <p className="career-notice" role="status">
                  Your application has been received. Thank you for applying.
                </p>
              )}
              {status === "failure" && (
                <p className="career-notice" role="alert">
                  {error}
                </p>
              )}
            </form>
          </div>
        </section>
      </main>
      <PublicSiteFooter />
    </div>
  );
}
