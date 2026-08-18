"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CityGroup = { regionName: string; cities: { id: string; name: string }[] };

export type RequestFormValues = {
  type: "ride" | "package";
  originCityId: string;
  destinationCityId: string;
  destinationText: string;
  neededDate: string; // yyyy-mm-dd
  neededTime: string;
  flexibleTime: boolean;
  seatsRequested: number;
  packageDescription: string;
  packageSize: string;
  notes: string;
};

// Sentinel <option> value that switches the "To" field from a City picker
// to a free-text input -- lets a poster name a destination that isn't in
// the seeded list (e.g. an airport) instead of only choosing from it.
const WRITE_IN_DESTINATION = "__write_in__";

// Create or edit a standalone Request ("need"). Edit mode is triggered by
// passing requestId -- same form, PATCH instead of POST. tripId is always
// left null here -- "request against a specific existing Trip" is a
// matching concept, deliberately not built yet.
export function RequestPostForm({
  citiesByRegion,
  requestId,
  initialValues,
}: {
  citiesByRegion: CityGroup[];
  requestId?: string;
  initialValues?: Partial<RequestFormValues>;
}) {
  const router = useRouter();
  const [type, setType] = useState<"ride" | "package">(
    initialValues?.type ?? "ride",
  );
  const [originCityId, setOriginCityId] = useState(
    initialValues?.originCityId ?? "",
  );
  const [destinationCityId, setDestinationCityId] = useState(
    initialValues?.destinationText ? WRITE_IN_DESTINATION : initialValues?.destinationCityId ?? "",
  );
  const [destinationText, setDestinationText] = useState(
    initialValues?.destinationText ?? "",
  );
  const [neededDate, setNeededDate] = useState(
    initialValues?.neededDate ?? "",
  );
  const [neededTime, setNeededTime] = useState(
    initialValues?.neededTime ?? "",
  );
  const [flexibleTime, setFlexibleTime] = useState(
    initialValues?.flexibleTime ?? false,
  );
  const [seatsRequested, setSeatsRequested] = useState(
    initialValues?.seatsRequested ?? 1,
  );
  const [packageDescription, setPackageDescription] = useState(
    initialValues?.packageDescription ?? "",
  );
  const [packageSize, setPackageSize] = useState(
    initialValues?.packageSize ?? "",
  );
  const [notes, setNotes] = useState(initialValues?.notes ?? "");
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("submitting");

    const res = await fetch(
      requestId ? `/api/requests/${requestId}` : "/api/requests",
      {
        method: requestId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          originCityId,
          destinationCityId:
            destinationCityId === WRITE_IN_DESTINATION ? undefined : destinationCityId,
          destinationText:
            destinationCityId === WRITE_IN_DESTINATION ? destinationText : undefined,
          neededDate: neededDate || undefined,
          neededTime: neededTime || undefined,
          flexibleTime,
          seatsRequested: type === "ride" ? Number(seatsRequested) : undefined,
          packageDescription:
            type === "package" ? packageDescription || undefined : undefined,
          packageSize: type === "package" ? packageSize || undefined : undefined,
          notes: notes || undefined,
        }),
      },
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Try again.");
      setStatus("idle");
      return;
    }

    if (requestId) {
      router.push(`/requests/${requestId}`);
    } else {
      const body = await res.json();
      router.push(`/requests/${body.requestId}`);
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      <fieldset>
        <legend>What do you need?</legend>
        <label>
          <input
            type="radio"
            name="type"
            checked={type === "ride"}
            onChange={() => setType("ride")}
          />
          {" "}
          A ride
        </label>
        <label style={{ marginLeft: "1rem" }}>
          <input
            type="radio"
            name="type"
            checked={type === "package"}
            onChange={() => setType("package")}
          />
          {" "}
          Something delivered
        </label>
      </fieldset>
      <div>
        <label htmlFor="originCityId">From</label>
        <select
          id="originCityId"
          required
          value={originCityId}
          onChange={(e) => setOriginCityId(e.target.value)}
        >
          <option value="" disabled>
            Select a city
          </option>
          {citiesByRegion.map((group) => (
            <optgroup key={group.regionName} label={group.regionName}>
              {group.cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="destinationCityId">To</label>
        <select
          id="destinationCityId"
          required
          value={destinationCityId}
          onChange={(e) => setDestinationCityId(e.target.value)}
        >
          <option value="" disabled>
            Select a city
          </option>
          {citiesByRegion.map((group) => (
            <optgroup key={group.regionName} label={group.regionName}>
              {group.cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </optgroup>
          ))}
          <option value={WRITE_IN_DESTINATION}>Other (type it in)</option>
        </select>
        {destinationCityId === WRITE_IN_DESTINATION && (
          <input
            id="destinationText"
            type="text"
            required
            maxLength={100}
            placeholder="e.g. LAX Airport"
            value={destinationText}
            onChange={(e) => setDestinationText(e.target.value)}
          />
        )}
      </div>
      <div>
        <label htmlFor="neededDate">Date needed (optional)</label>
        <input
          id="neededDate"
          type="date"
          value={neededDate}
          onChange={(e) => setNeededDate(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="neededTime">Time needed (optional)</label>
        <input
          id="neededTime"
          type="time"
          value={neededTime}
          onChange={(e) => setNeededTime(e.target.value)}
        />
      </div>
      <div>
        <label>
          <input
            type="checkbox"
            checked={flexibleTime}
            onChange={(e) => setFlexibleTime(e.target.checked)}
          />
          {" "}
          My time is flexible
        </label>
      </div>
      {type === "ride" ? (
        <div>
          <label htmlFor="seatsRequested">Seats needed</label>
          <input
            id="seatsRequested"
            type="number"
            min={1}
            max={10}
            required
            value={seatsRequested}
            onChange={(e) => setSeatsRequested(Number(e.target.value))}
          />
        </div>
      ) : (
        <>
          <div>
            <label htmlFor="packageDescription">
              What are you sending? (optional)
            </label>
            <input
              id="packageDescription"
              type="text"
              placeholder="e.g. a box of textbooks"
              value={packageDescription}
              onChange={(e) => setPackageDescription(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="packageSize">Size (optional)</label>
            <input
              id="packageSize"
              type="text"
              placeholder="e.g. shoebox-sized"
              value={packageSize}
              onChange={(e) => setPackageSize(e.target.value)}
            />
          </div>
        </>
      )}
      <div>
        <label htmlFor="notes">Notes (optional)</label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={status === "submitting"}>
        {status === "submitting"
          ? "Saving…"
          : requestId
            ? "Save changes"
            : "Post Request"}
      </button>
    </form>
  );
}
