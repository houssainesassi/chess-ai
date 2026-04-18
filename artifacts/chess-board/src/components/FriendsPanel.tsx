import { useState } from "react";
import {
  useFriends,
  useSendFriendRequest,
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useRemoveFriend,
  useSendGameInvite,
  useChallengePlayer,
  useProfileSearch,
  type FriendEntry,
} from "@/hooks/use-friends";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { getCountryByCode } from "@/lib/countries";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  UserPlus,
  Search,
  Check,
  X,
  Swords,
  Clock,
  UserMinus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

function FriendRow({
  entry,
  onInvite,
  onRemove,
  inviting,
}: {
  entry: FriendEntry;
  onInvite?: () => void;
  onRemove?: () => void;
  inviting: boolean;
}) {
  const country = entry.profile ? getCountryByCode(entry.profile.country) : undefined;

  return (
    <div className="flex items-center gap-3 py-2">
      <PlayerAvatar profile={entry.profile ?? undefined} size="sm" showFlag={false} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate flex items-center gap-1">
          {country?.flag}
          <span>{entry.profile?.nickname ?? entry.userId.slice(0, 8) + "…"}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {onInvite && (
          <button
            onClick={onInvite}
            disabled={inviting}
            title="Challenge to a game"
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors disabled:opacity-40 border border-primary/20"
          >
            <Swords size={12} />
            {inviting ? "Sent!" : "Challenge"}
          </button>
        )}
        {onRemove && (
          <button
            onClick={onRemove}
            title="Remove friend"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <UserMinus size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

function PendingRow({
  entry,
  direction,
  onAccept,
  onDecline,
}: {
  entry: FriendEntry;
  direction: "in" | "out";
  onAccept?: () => void;
  onDecline?: () => void;
}) {
  const country = entry.profile ? getCountryByCode(entry.profile.country) : undefined;

  return (
    <div className="flex items-center gap-3 py-2">
      <PlayerAvatar profile={entry.profile ?? undefined} size="sm" showFlag={false} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate flex items-center gap-1">
          {country?.flag}
          <span>{entry.profile?.nickname ?? entry.userId.slice(0, 8) + "…"}</span>
        </div>
        <div className="text-[11px] text-muted-foreground">
          {direction === "in" ? "Wants to be friends" : "Request sent"}
        </div>
      </div>
      {direction === "in" && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onAccept}
            className="p-1.5 rounded-lg text-green-400 hover:bg-green-400/10 transition-colors"
            title="Accept"
          >
            <Check size={15} />
          </button>
          <button
            onClick={onDecline}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Decline"
          >
            <X size={15} />
          </button>
        </div>
      )}
      {direction === "out" && (
        <Clock size={13} className="text-muted-foreground flex-shrink-0" />
      )}
    </div>
  );
}

export function FriendsPanel() {
  const { toast } = useToast();
  const [searchQ, setSearchQ] = useState("");
  const [expanded, setExpanded] = useState(true);
  const [invitingIds, setInvitingIds] = useState<Set<string>>(new Set());
  const [challengingIds, setChallengingIds] = useState<Set<string>>(new Set());

  const { data: friendsData, isLoading } = useFriends();
  const { data: searchResults } = useProfileSearch(searchQ);
  const sendRequest = useSendFriendRequest();
  const acceptRequest = useAcceptFriendRequest();
  const declineRequest = useDeclineFriendRequest();
  const removeRequest = useRemoveFriend();
  const sendInvite = useSendGameInvite();
  const challengePlayer = useChallengePlayer();

  const pendingOutIds = new Set((friendsData?.pendingOut ?? []).map((e) => e.userId));
  const friendIds = new Set((friendsData?.friends ?? []).map((e) => e.userId));

  const handleSendRequest = async (toUserId: string) => {
    try {
      await sendRequest.mutateAsync(toUserId);
      toast({ title: "Friend request sent!" });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    }
  };

  const handleAccept = async (requestId: string) => {
    try {
      await acceptRequest.mutateAsync(requestId);
      toast({ title: "Friend added!" });
    } catch {
      toast({ title: "Failed to accept", variant: "destructive" });
    }
  };

  const handleDecline = async (requestId: string) => {
    try {
      await declineRequest.mutateAsync(requestId);
    } catch {
      toast({ title: "Failed to decline", variant: "destructive" });
    }
  };

  const handleRemove = async (friendUserId: string) => {
    try {
      await removeRequest.mutateAsync(friendUserId);
      toast({ title: "Friend removed" });
    } catch {
      toast({ title: "Failed to remove friend", variant: "destructive" });
    }
  };

  const handleInvite = async (toUserId: string) => {
    setInvitingIds((s) => new Set(s).add(toUserId));
    try {
      await sendInvite.mutateAsync(toUserId);
      toast({ title: "Challenge sent!", description: "Waiting for your friend to accept." });
    } catch (e: any) {
      toast({ title: e.message ?? "Failed to send challenge", variant: "destructive" });
    } finally {
      setTimeout(() => {
        setInvitingIds((s) => { const next = new Set(s); next.delete(toUserId); return next; });
      }, 3000);
    }
  };

  const handleChallenge = async (toUserId: string) => {
    setChallengingIds((s) => new Set(s).add(toUserId));
    try {
      await challengePlayer.mutateAsync(toUserId);
      toast({ title: "Challenge sent!", description: "Waiting for them to accept." });
    } catch (e: any) {
      toast({ title: e.message ?? "Failed to send challenge", variant: "destructive" });
    } finally {
      setTimeout(() => {
        setChallengingIds((s) => { const next = new Set(s); next.delete(toUserId); return next; });
      }, 3000);
    }
  };

  const friends = friendsData?.friends ?? [];
  const pendingIn = friendsData?.pendingIn ?? [];
  const pendingOut = friendsData?.pendingOut ?? [];

  const totalNotifications = pendingIn.length;

  return (
    <section>
      <button
        className="flex items-center gap-2 mb-4 w-full text-left group"
        onClick={() => setExpanded((e) => !e)}
      >
        <Users size={18} className="text-muted-foreground" />
        <h3 className="text-lg font-semibold flex-1">Friends</h3>
        {totalNotifications > 0 && (
          <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-bold">
            {totalNotifications}
          </span>
        )}
        <span className="text-muted-foreground">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {expanded && (
        <div className="rounded-xl border border-border/50 bg-secondary/5 p-4 space-y-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search players by nickname…"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-border/50 bg-secondary/20 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {searchQ.trim().length >= 2 && (
            <div className="space-y-0.5">
              {!searchResults || searchResults.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No players found.</p>
              ) : (
                searchResults.map((profile) => {
                  const isFriend = friendIds.has(profile.userId);
                  const isPending = pendingOutIds.has(profile.userId);
                  const isPendingIn = pendingIn.some((e) => e.userId === profile.userId);
                  const country = getCountryByCode(profile.country);
                  const isChallenging = challengingIds.has(profile.userId);

                  return (
                    <div key={profile.userId} className="flex items-center gap-3 py-2">
                      <PlayerAvatar profile={profile} size="sm" showFlag={false} />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate">
                          {country?.flag} {profile.nickname}
                        </span>
                        {isFriend && (
                          <div className="text-[10px] text-primary/70">Friend</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Challenge button — works for any player */}
                        <button
                          onClick={() => handleChallenge(profile.userId)}
                          disabled={isChallenging}
                          title="Challenge to a game"
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors disabled:opacity-40"
                        >
                          <Swords size={11} />
                          {isChallenging ? "Sent!" : "Challenge"}
                        </button>
                        {/* Add Friend button — only for non-friends */}
                        {!isFriend && !isPending && !isPendingIn && (
                          <button
                            onClick={() => handleSendRequest(profile.userId)}
                            disabled={sendRequest.isPending}
                            title="Add friend"
                            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-secondary/60 hover:bg-secondary transition-colors border border-border/50"
                          >
                            <UserPlus size={11} />
                          </button>
                        )}
                        {(isPending || isPendingIn) && !isFriend && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock size={11} /> Pending
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {pendingIn.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                Requests ({pendingIn.length})
              </div>
              <div className="divide-y divide-border/20">
                {pendingIn.map((entry) => (
                  <PendingRow
                    key={entry.requestId}
                    entry={entry}
                    direction="in"
                    onAccept={() => handleAccept(entry.requestId)}
                    onDecline={() => handleDecline(entry.requestId)}
                  />
                ))}
              </div>
            </div>
          )}

          {friends.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                Friends ({friends.length})
              </div>
              <div className="divide-y divide-border/20">
                {friends.map((entry) => (
                  <FriendRow
                    key={entry.requestId}
                    entry={entry}
                    onInvite={() => handleInvite(entry.userId)}
                    onRemove={() => handleRemove(entry.userId)}
                    inviting={invitingIds.has(entry.userId)}
                  />
                ))}
              </div>
            </div>
          )}

          {pendingOut.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                Sent
              </div>
              <div className="divide-y divide-border/20">
                {pendingOut.map((entry) => (
                  <PendingRow key={entry.requestId} entry={entry} direction="out" />
                ))}
              </div>
            </div>
          )}

          {isLoading && (
            <div className="text-xs text-muted-foreground text-center py-2">Loading…</div>
          )}

          {!isLoading && friends.length === 0 && pendingIn.length === 0 && pendingOut.length === 0 && searchQ.length < 2 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Search for players above to add friends.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
