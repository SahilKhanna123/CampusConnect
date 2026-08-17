"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CityGroup = { regionName: string; cities: { id: string; name: string }[] };

// Shared by the student onboarding page, step 0 of the parent
// /family/connect-student wizard, and self-editing on /profile -- all three
// collect the same name/photo/home-city fields via PATCH /api/profile.
// University, badges, and any other verification-derived data are
// deliberately not present here at all: they're never user-editable.
export function ProfileEditForm({
  initialName,
  initialPhotoUrl,
  initialHomeCityId,
  citiesByRegion,
  submitLabel,
  redirectTo,
  onSaved,
}: {
  initialName: string;
  initialPhotoUrl: string | null;
  initialHomeCityId: string | null;
  citiesByRegion: CityGroup[];
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
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState<string | null>(null);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPhotoFile(file);
    if (file) setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("submitting");

    const formData = new FormData();
    formData.set("name", name);
    formData.set("homeCityId", homeCityId);
    if (photoFile) formData.set("photo", photoFile);

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
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
