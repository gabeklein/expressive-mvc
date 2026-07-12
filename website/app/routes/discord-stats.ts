const inviteUrl = 'https://discord.com/api/v10/invites/EBWC7HyTBd?with_counts=true';
const fallbackMembers = 4;

export async function loader() {
  let members = fallbackMembers;

  try {
    const response = await fetch(inviteUrl);
    const invite = response.ok ? await response.json() : null;

    if (typeof invite?.approximate_member_count === 'number') {
      members = invite.approximate_member_count;
    }
  } catch {}

  return Response.json(
    { members },
    { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600' } },
  );
}
