import { describe, it, expect, beforeEach } from "vitest";
import { resetAndSeed } from "@/lib/testDb";
import { createUser, createCity } from "@/lib/testDbFixtures";
import { prisma } from "@/lib/prisma";
import { getPublicProfile } from "./profile";

beforeEach(async () => {
  await resetAndSeed();
});

describe("getPublicProfile", () => {
  it("returns null for a nonexistent user", async () => {
    expect(await getPublicProfile("no-such-user")).toBeNull();
  });

  it("never leaks private fields (phone, signedUpAsParent) into the returned shape", async () => {
    const city = await createCity({ name: "Irvine" });
    const user = await createUser({
      phone: "555-0100",
      signedUpAsParent: true,
      homeCityId: city.id,
      major: "Computer Science",
      year: "Junior",
    });

    const profile = await getPublicProfile(user.id);

    expect(profile).not.toBeNull();
    expect(profile).not.toHaveProperty("phone");
    expect(profile).not.toHaveProperty("email");
    expect(profile).not.toHaveProperty("signedUpAsParent");
    expect(profile).not.toHaveProperty("studentRecord");
    expect(profile).not.toHaveProperty("parentLinksAsParent");

    // Public fields still come through correctly.
    expect(profile?.major).toBe("Computer Science");
    expect(profile?.year).toBe("Junior");
    expect(profile?.homeArea).toContain("Irvine");
  });

  it("derives university name and badges from verified VerificationRecords only", async () => {
    const user = await createUser();
    await prisma.verificationRecord.create({
      data: {
        userId: user.id,
        type: "email",
        status: "verified",
        verifiedAt: new Date(),
      },
    });
    await prisma.verificationRecord.create({
      data: {
        userId: user.id,
        type: "university",
        status: "verified",
        verifiedAt: new Date(),
        metadata: { university: "UC Irvine", domain: "uci.edu" },
      },
    });
    // A pending (not yet verified) record must NOT count toward badges.
    await prisma.verificationRecord.create({
      data: { userId: user.id, type: "identity", status: "pending" },
    });

    const profile = await getPublicProfile(user.id);

    expect(profile?.university).toBe("UC Irvine");
    expect(profile?.badges).toEqual({
      email: true,
      university: true,
      parentRelationship: false,
      identity: false,
    });
  });

  it("returns null homeArea and university when neither is set", async () => {
    const user = await createUser();
    const profile = await getPublicProfile(user.id);

    expect(profile?.homeArea).toBeNull();
    expect(profile?.university).toBeNull();
  });
});
