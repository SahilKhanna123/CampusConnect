"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CityGroup = { regionName: string; cities: { id: string; name: string }[] };
type PackagePostKind = "offering_space" | "needing_delivery";

export type PackagePostFormValues = {
  kind: PackagePostKind;
  originCityId: string;
  destinationCityId: string;
  destinationText: string;
  date: string; // yyyy-mm-dd
  time: string;
  flexibleTime: boolean;
  notes: string;
  studentsOnly: boolean;
};

// Sentinel <option> value that switches the "To" field from a City picker
// to a free-text input -- same convention as TripPostForm/RequestPostForm.
const WRITE_IN_DESTINATION = "__write_in__";

// Create or edit a PackagePost. Edit mode is triggered by passing
// packagePostId -- same form, PATCH instead of POST. Deliberately minimal
// per product decision: no structured description/size fields, no
// seat/capacity concept -- just route + rough timing. Anything more
// specific than the short optional `notes` field is meant to happen in a
// DM (see PackageMessageForm.tsx), not a form field.
export function PackagePostForm({
  citiesByRegion,
  packagePostId,
  initialValues,
  isStudent,
}: {
  citiesByRegion: CityGroup[];
  packagePostId?: string;
  initialValues?: Partial<PackagePostFormValues>;
  isStudent: boolean;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<PackagePostKind>(
    initialValues?.kind ?? "offering_space",
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
  const [date, setDate] = useState(initialValues?.date ?? "");
  const [time, setTime] = useState(initialValues?.time ?? "");
  const [flexibleTime, setFlexibleTime] = useState(
    initialValues?.flexibleTime ?? false,
  );
  const [notes, setNotes] = useState(initialValues?.notes ?? "");
  const [studentsOnly, setStudentsOnly] = useState(
    initialValues?.studentsOnly ?? false,
  );
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("submitting");

    const res = await fetch(
      packagePostId ? `/api/package-posts/${packagePostId}` : "/api/package-posts",
      {
        method: packagePostId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          originCityId,
          destinationCityId:
            destinationCityId === WRITE_IN_DESTINATION ? undefined : destinationCityId,
          destinationText:
            destinationCityId === WRITE_IN_DESTINATION ? destinationText : undefined,
          date: date || undefined,
          time: time || undefined,
          flexibleTime,
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

    if (packagePostId) {
      router.push(`/package-posts/${packagePostId}`);
    } else {
      const body = await res.json();
      router.push(`/package-posts/${body.packagePostId}`);
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="app-form">
      <fieldset>
        <legend>What do you need?</legend>
        <label>
          <input
            type="radio"
            name="kind"
            checked={kind === "offering_space"}
            onChange={() => setKind("offering_space")}
          />
          {" "}
          I have package space
        </label>
        <label style={{ marginLeft: "1rem" }}>
          <input
            type="radio"
            name="kind"
            checked={kind === "needing_delivery"}
            onChange={() => setKind("needing_delivery")}
          />
          {" "}
          I need something delivered
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
        <label htmlFor="date">Date (optional)</label>
        <input
          id="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="time">Time leaving (optional)</label>
        <input
          id="time"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
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
        <label htmlFor="notes">Notes (optional)</label>
        <textarea
          id="notes"
          maxLength={300}
          placeholder="Anything else worth mentioning -- details are best left for a DM"
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
          : packagePostId
            ? "Save changes"
            : "Post"}
      </button>
    </form>
  );
}
