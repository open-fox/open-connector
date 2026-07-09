import { afterEach, describe, expect, it, vi } from "vitest";
import { apiKeyCredential } from "../provider-proxy-loader.test-helpers.ts";
import { credentialValidators, executors } from "./executors.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const locationPayload = {
  Version: 1,
  Key: "349727",
  Type: "City",
  Rank: 15,
  LocalizedName: "New York",
  EnglishName: "New York",
  Country: {
    ID: "US",
    LocalizedName: "United States",
    EnglishName: "United States",
  },
  AdministrativeArea: {
    ID: "NY",
    LocalizedName: "New York",
    EnglishName: "New York",
  },
};

describe("AccuWeather executors", () => {
  it("validates API keys with the autocomplete endpoint and Bearer auth", async () => {
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => jsonResponse([locationPayload]),
    );

    const result = await credentialValidators.apiKey?.(
      { apiKey: "test_key", values: { apiKey: "test_key" } },
      {
        fetcher,
      },
    );

    expect(result).toEqual({
      profile: {
        accountId: "api_key",
        displayName: "AccuWeather API Key",
      },
      grantedScopes: [],
      metadata: {
        apiBaseUrl: "https://dataservice.accuweather.com",
        validationEndpoint: "/locations/v1/cities/autocomplete",
        validationLocationKey: "349727",
      },
    });
    expect(fetcher).toHaveBeenCalledWith(
      new URL("https://dataservice.accuweather.com/locations/v1/cities/autocomplete?q=New+York"),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          authorization: "Bearer test_key",
        }),
      }),
    );
  });

  it("searches locations and normalizes AccuWeather location keys", async () => {
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => jsonResponse([locationPayload]),
    );
    vi.stubGlobal("fetch", fetcher);

    const result = await executors["accuweather.search_locations"]?.(
      {
        query: "New York",
        language: "en-us",
        details: true,
        offset: 10,
        alias: 0,
      },
      {
        getCredential: async () => apiKeyCredential("test_key"),
      },
    );

    expect(result).toEqual({
      ok: true,
      output: {
        locations: [
          {
            key: "349727",
            localizedName: "New York",
            englishName: "New York",
            type: "City",
            rank: 15,
            country: locationPayload.Country,
            administrativeArea: locationPayload.AdministrativeArea,
            raw: locationPayload,
          },
        ],
        raw: [locationPayload],
      },
    });
    expect(fetcher).toHaveBeenCalledWith(
      new URL(
        "https://dataservice.accuweather.com/locations/v1/cities/search?q=New+York&language=en-us&details=true&offset=10&alias=0",
      ),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          authorization: "Bearer test_key",
        }),
      }),
    );
  });

  it("returns daily forecasts with headline and forecast records", async () => {
    const payload = {
      Headline: {
        Text: "Pleasant weather.",
        Category: "mild",
      },
      DailyForecasts: [
        {
          Date: "2026-07-09T07:00:00-04:00",
          Temperature: {
            Minimum: { Value: 68, Unit: "F" },
            Maximum: { Value: 82, Unit: "F" },
          },
        },
      ],
    };
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => jsonResponse(payload),
    );
    vi.stubGlobal("fetch", fetcher);

    const result = await executors["accuweather.get_daily_forecast"]?.(
      {
        locationKey: "349727",
        duration: "5day",
        metric: true,
      },
      {
        getCredential: async () => apiKeyCredential("test_key"),
      },
    );

    expect(result).toEqual({
      ok: true,
      output: {
        headline: payload.Headline,
        dailyForecasts: payload.DailyForecasts,
        raw: payload,
      },
    });
    expect(fetcher).toHaveBeenCalledWith(
      new URL("https://dataservice.accuweather.com/forecasts/v1/daily/5day/349727?metric=true"),
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("maps execution 401 responses to authorization failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (): Promise<Response> =>
          jsonResponse(
            {
              Code: "Unauthorized",
              Message: "API authorization failed.",
            },
            401,
          ),
      ),
    );

    const result = await executors["accuweather.get_current_conditions"]?.(
      {
        locationKey: "349727",
      },
      {
        getCredential: async () => apiKeyCredential("bad_key"),
      },
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "authorization_failed",
        message: "API authorization failed.",
      },
    });
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}
