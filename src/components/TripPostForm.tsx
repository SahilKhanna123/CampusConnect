"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CityGroup = { regionName: string; cities: { id: string; name: string }[] };

export type TripFormValues = {
  title: string;
  originCityId: string;
  destinationCityId: string;
  destinationText: string;
  departureDate: string; // yyyy-mm-dd
  departureTime: string;
  flexibleTime: boolean;
  seatsTotal: number;
  packageSpaceAvailable: boolean;
  packageCapacityNote: string;
  tripNotes: string;
  studentsOnly: boolean;
};

// Sentinel <option> value that switches the "To" field from a City picker
// to a free-text input -- lets a poster name a destination that isn't in
// the seeded list (e.g. an airport) instead of only choosing from it.
const WRITE_IN_DESTINATION = "__write_in__";

// Create or edit a Trip ("offer"). Edit mode is triggered by passing
// tripId -- same form, PATCH instead of POST, same convention as
// ProfileEditForm (the form always submits the full set of fields, never a
// partial patch).
export function TripPostForm({
  citiesByRegion,
  tripId,
  initialValues,
  isStudent,
}: {
  citiesByRegion: CityGroup[];
  tripId?: string;
  initialValues?: Partial<TripFormValues>;
  // Whether the CURRENT VIEWER (not the trip, if editing) has a claimed
  // StudentRecord -- controls whether the "Visible to students only"
  // checkbox renders at all. Not just a UI nicety: POST/PATCH /api/trips
  // reject studentsOnly=true server-side for a non-student caller too, so
  // hiding the checkbox here is purely to avoid offering a control that
  // would just 403 on submit.
  isStudent: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [originCityId, setOriginCityId] = useState(
    initialValues?.originCityId ?? "",
  );
  const [destinationCityId, setDestinationCityId] = useState(
    initialValues?.destinationText ? WRITE_IN_DESTINATION : initialValues?.destinationCityId ?? "",
  );
  const [destinationText, setDestinationText] = useState(
    initialValues?.destinationText ?? "",
  );
  const [departureDate, setDepartureDate] = useState(
    initialValues?.departureDate ?? "",
  );
  const [departureTime, setDepartureTime] = useState(
    initialValues?.departureTime ?? "",
  );
  const [flexibleTime, setFlexibleTime] = useState(
    initialValues?.flexibleTime ?? false,
  );
  const [seatsTotal, setSeatsTotal] = useState(
    initialValues?.seatsTotal ?? 1,
  );
  const [packageSpaceAvailable, setPackageSpaceAvailable] = useState(
    initialValues?.packageSpaceAvailable ?? false,
  );
  const [packageCapacityNote, setPackageCapacityNote] = useState(
    initialValues?.packageCapacityNote ?? "",
  );
  const [tripNotes, setTripNotes] = useState(initialValues?.tripNotes ?? "");
  const [studentsOnly, setStudentsOnly] = useState(
    initialValues?.studentsOnly ?? false,
  );
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("submitting");

    const res = await fetch(tripId ? `/api/trips/${tripId}` : "/api/trips", {
      method: tripId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        originCityId,
        destinationCityId:
          destinationCityId === WRITE_IN_DESTINATION ? undefined : destinationCityId,
        destinationText:
          destinationCityId === WRITE_IN_DESTINATION ? destinationText : undefined,
        departureDate,
        departureTime: departureTime || undefined,
        flexibleTime,
        seatsTotal: Number(seatsTotal),
        packageSpaceAvailable,
        packageCapacityNote: packageCapacityNote || undefined,
        tripNotes: tripNotes || undefined,
        studentsOnly: isStudent ? studentsOnly : false,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Try again.");
      setStatus("idle");
      return;
    }

    if (tripId) {
      router.push(`/trips/${tripId}`);
    } else {
      const body = await res.json();
      router.push(`/trips/${body.tripId}`);
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="title">Subject</label>
        <input
          id="title"
          type="text"
          required
          maxLength={100}
          placeholder="e.g. Weekend trip home, 2 seats free"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
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
        <label htmlFor="departureDate">Departure date</label>
        <input
          id="departureDate"
          type="date"
          required
          value={departureDate}
          onChange={(e) => setDepartureDate(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="departureTime">Departure time (optional)</label>
        <input
          id="departureTime"
          type="time"
          value={departureTime}
          onChange={(e) => setDepartureTime(e.target.value)}
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
        <label htmlFor="seatsTotal">Seats available</label>
        <input
          id="seatsTotal"
          type="number"
          min={0}
          max={20}
          required
          value={seatsTotal}
          onChange={(e) => setSeatsTotal(Number(e.target.value))}
        />
      </div>
      <div>
        <label>
          <input
            type="checkbox"
            checked={packageSpaceAvailable}
            onChange={(e) => setPackageSpaceAvailable(e.target.checked)}
          />
          {" "}
          I also have package space
        </label>
      </div>
      {packageSpaceAvailable && (
        <div>
          <label htmlFor="packageCapacityNote">
            Package space details (optional)
          </label>
          <input
            id="packageCapacityNote"
            type="text"
            placeholder="e.g. small boxes only, one large duffel"
            value={packageCapacityNote}
            onChange={(e) => setPackageCapacityNote(e.target.value)}
          />
        </div>
      )}
      <div>
        <label htmlFor="tripNotes">Notes (optional)</label>
        <textarea
          id="tripNotes"
          placeholder="e.g. driving my own car, meeting at the BART station"
          value={tripNotes}
          onChange={(e) => setTripNotes(e.target.value)}
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
          : tripId
            ? "Save changes"
            : "Post Trip"}
      </button>
    </form>
  );
}
