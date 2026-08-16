// Family/Parents — student invites a parent by email (ParentStudentInvite);
// parent's account is created at invite-acceptance time, then the student
// must separately approve (ParentStudentLink). A parent account has zero
// posting/viewing capability until that link reaches `approved`.
// TODO: student view — send invite, see pending/approved links.
// TODO: parent view — accept invite, see approval status.

export default function FamilyPage() {
  return (
    <div>
      <h1>Family</h1>
      <p>Invite a parent, or manage your parent/student links.</p>
    </div>
  );
}
