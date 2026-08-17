"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LOOKING_FOR_OPTIONS } from "@/lib/lookingFor";

type CityGroup = { regionName: string; cities: { id: string; name: string }[] };

// Shared by the student onboarding page, step 0 of the parent
// /family/connect-student wizard, and self-editing on /profile -- all three
// collect name/photo/home-city, plus a persona-specific set of optional
// enrichment fields gated by `isParent`: students get major/year/travel
// preferences/looking-for, parents get a phone number. University, badges,
// and any other verification-derived data are deliberately not present
// here at all: they're never user-editable.
export function ProfileEditForm({
  initialName,
  initialPhotoUrl,
  initialHomeCityId,
  citiesByRegion,
  isParent,
  initialMajor,
  initialYear,
  initialTravelPreferences,
  initialLookingFor,
  initialPhone,
  initialLinkedStudentName,
  submitLabel,
  redirectTo,
  onSaved,
}: {
  initialName: string;
  initialPhotoUrl: string | null;
  initialHomeCityId: string | null;
  citiesByRegion: CityGroup[];
  isParent: boolean;
  initialMajor: string | null;
  initialYear: string | null;
  initialTravelPreferences: string | null;
  initialLookingFor: string[];
  initialPhone: string | null;
  initialLinkedStudentName: string | null;
  submitLabel: string;
  redirectTo?: string;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [homeCityId, setHomeCityId] = useState(initialHomeCityId ?? "");
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    initialPhotoUrl,
  );
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [major, setMajor] = useState(initialMajor ?? "");
  const [year, setYear] = useState(initialYear ?? "");
  const [travelPreferences, setTravelPreferences] = useState(
    initialTravelPreferences ?? "",
  );
  const [lookingFor, setLookingFor] = useState<string[]>(initialLookingFor);
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [linkedStudentName, setLinkedStudentName] = useState(
    initialLinkedStudentName ?? "",
  );
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState<string | null>(null);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPhotoFile(file);
    if (file) setPhotoPreview(URL.createObjectURL(file));
  }

  function toggleLookingFor(value: string) {
    setLookingFor((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("submitting");

    const formData = new FormData();
    formData.set("name", name);
    formData.set("homeCityId", homeCityId);
    if (photoFile) formData.set("photo", photoFile);
    if (isParent) {
      formData.set("phone", phone);
      formData.set("linkedStudentName", linkedStudentName);
    } else {
      formData.set("major", major);
      formData.set("year", year);
      formData.set("travelPreferences", travelPreferences);
      lookingFor.forEach((value) => formData.append("lookingFor", value));
    }

    const res = await fetch("/api/profile", { method: "PATCH", body: formData });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Try again.");
      setStatus("idle");
      return;
    }

    setStatus("idle");
    onSaved?.();
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="name">Full name</label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="photo">Profile photo (optional)</label>
        {photoPreview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoPreview}
            alt=""
            width={64}
            height={64}
            style={{ borderRadius: "50%", display: "block", objectFit: "cover" }}
          />
        )}
        <input
          id="photo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handlePhotoChange}
        />
      </div>
      <div>
        <label htmlFor="homeCityId">Home city / area</label>
        <select
          id="homeCityId"
          required
          value={homeCityId}
          onChange={(e) => setHomeCityId(e.target.value)}
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

      {isParent ? (
        <>
          <div>
            <label htmlFor="linkedStudentName">
              Student&apos;s name (optional)
            </label>
            <input
              id="linkedStudentName"
              type="text"
              placeholder="Who are you connected to on CampusConnect?"
              value={linkedStudentName}
              onChange={(e) => setLinkedStudentName(e.target.value)}
            />
            <p>
              Shown on your public profile so others know who you&apos;re
              posting on behalf of.
            </p>
          </div>
          <div>
            <label htmlFor="phone">Phone number (optional)</label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <p>Private -- never shown on your public profile.</p>
          </div>
        </>
      ) : (
        <>
          <div>
            <label htmlFor="major">Major (optional)</label>
            <input
              id="major"
              type="text"
              value={major}
              onChange={(e) => setMajor(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="year">Year (optional)</label>
            <input
              id="year"
              type="text"
              placeholder="e.g. Junior, or 2027"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="travelPreferences">
              Travel preferences (optional)
            </label>
            <textarea
              id="travelPreferences"
              placeholder="e.g. usually travels weekends, prefer driving over flying"
              value={travelPreferences}
              onChange={(e) => setTravelPreferences(e.target.value)}
            />
          </div>
          <fieldset>
            <legend>What are you looking for? (optional)</legend>
            {LOOKING_FOR_OPTIONS.map((option) => (
              <label key={option.value} style={{ display: "block" }}>
                <input
                  type="checkbox"
                  checked={lookingFor.includes(option.value)}
                  onChange={() => toggleLookingFor(option.value)}
                />
                {" "}
                {option.label}
              </label>
            ))}
          </fieldset>
        </>
      )}

      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
