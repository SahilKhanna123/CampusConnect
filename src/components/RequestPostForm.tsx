"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CityGroup = { regionName: string; cities: { id: string; name: string }[] };
type TripCategory = "personal_car" | "uber_share";

export type RequestFormValues = {
  category: TripCategory;
  originCityId: string;
  destinationCityId: string;
  destinationText: string;
  neededDate: string; // yyyy-mm-dd
  neededTime: string;
  flexibleTime: boolean;
  seatsRequested: number;
  estimatedFarePerSeat: string;
  notes: string;
  studentsOnly: boolean;
};

// Sentinel <option> value that switches the "To" field from a City picker
// to a free-text input -- lets a poster name a destination that isn't in
// the seeded list (e.g. an airport) instead of only choosing from it.
const WRITE_IN_DESTINATION = "__write_in__";

// Create or edit a standalone ride Request ("need"). Edit mode is triggered
// by passing requestId -- same form, PATCH instead of POST. tripId is
// always left null here -- "request against a specific existing Trip" is a
// matching concept, deliberately not built yet. category mirrors Trip's own
// category (personal_car vs. uber_share) -- package needs moved out to the
// standalone PackagePost model entirely, see PackagePostForm.tsx.
export function RequestPostForm({
  citiesByRegion,
  requestId,
  initialValues,
  isStudent,
}: {
  citiesByRegion: CityGroup[];
  requestId?: string;
  initialValues?: Partial<RequestFormValues>;
  // Whether the current viewer has a claimed StudentRecord -- see the same
  // prop on TripPostForm for the full rationale.
  isStudent: boolean;
}) {
  const router = useRouter();
  const [category, setCategory] = useState<TripCategory>(
    initialValues?.category ?? "personal_car",
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
  const [estimatedFarePerSeat, setEstimatedFarePerSeat] = useState(
    initialValues?.estimatedFarePerSeat ?? "",
  );
  const [notes, setNotes] = useState(initialValues?.notes ?? "");
  const [studentsOnly, setStudentsOnly] = useState(
    initialValues?.studentsOnly ?? false,
  );
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState<string | null>(null);

  const isUberShare = category === "uber_share";

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
          category,
          originCityId,
          destinationCityId:
            destinationCityId === WRITE_IN_DESTINATION ? undefined : destinationCityId,
          destinationText:
            destinationCityId === WRITE_IN_DESTINATION ? destinationText : undefined,
          neededDate: neededDate || undefined,
          neededTime: neededTime || undefined,
          flexibleTime,
          seatsRequested: Number(seatsRequested),
          estimatedFarePerSeat:
            isUberShare && estimatedFarePerSeat ? Number(estimatedFarePerSeat) : undefined,
          notes: notes || undefined,
          studentsOnly: isStudent ? studentsOnly : false,
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
    <form onSubmit={handleSubmit} className="app-form">
      <fieldset>
        <legend>What kind of ride?</legend>
        <label>
          <input
            type="radio"
            name="category"
            checked={category === "personal_car"}
            onChange={() => setCategory("personal_car")}
          />
          {" "}
          Someone's own car
        </label>
        <label style={{ marginLeft: "1rem" }}>
          <input
            type="radio"
            name="category"
            checked={category === "uber_share"}
            onChange={() => setCategory("uber_share")}
          />
          {" "}
          Splitting an Uber/Lyft
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
      {isUberShare && (
        <div>
          <label htmlFor="estimatedFarePerSeat">
            Estimated fare per seat, if you have one in mind ($, optional)
          </label>
          <input
            id="estimatedFarePerSeat"
            type="number"
            min={0}
            step="0.01"
            placeholder="e.g. 12.50"
            value={estimatedFarePerSeat}
            onChange={(e) => setEstimatedFarePerSeat(e.target.value)}
          />
        </div>
      )}
      <div>
        <label htmlFor="notes">Notes (optional)</label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      {isStudent && (
        <div>
          <label>
            <input
              type="checkbox"
              checked={studentsOnly}
              onChange={(e) => setStudentsOnly(e.target.checked)}
            />
            {" "}
            🎓 Visible to students only
          </label>
        </div>
      )}
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
