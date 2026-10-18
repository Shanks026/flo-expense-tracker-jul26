import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Share, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Pencil,
  Share2,
  Plus,
  Lock,
  Unlock,
  AlertTriangle,
  UserPlus,
  Link2,
  ListPlus,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { format, parseISO } from 'date-fns';
import Card from '../../../components/Card';
import IconTile from '../../../components/IconTile';
import CategoryIcon from '../../../components/CategoryIcon';
import Pill from '../../../components/Pill';
import Button from '../../../components/Button';
import Skeleton from '../../../components/Skeleton';
import { memberInitial } from '../../../components/SplitMemberChip';
import { colors as staticColors, fontFamily, fontSize, spacing, radii } from '../../../theme/tokens';
import { useTheme } from '../../../theme/ThemeContext';
import useSplit from '../../../hooks/useSplit';
import useSplitPeople from '../../../hooks/useSplitPeople';
import useCurrency from '../../../hooks/useCurrency';
import { formatMoney } from '../../../lib/currency';
import {
  buildSummaryText,
  explainBalances,
  groupDebtsByDebtor,
  groupCreditsByCreditor,
} from '../../../lib/splitMath';
import { buildSplitCsv, shareCsv, buildSplitHtml, sharePdf, exportFilename } from '../../../lib/export';
import {
  closeSplit,
  reopenSplit,
  addMembers,
  removeMember,
  getOrCreateInvite,
  revokeInvites,
  INVITE_TTL_DAYS,
} from '../../../lib/splits';
import { useDataRefresh } from '../../../lib/DataRefreshContext';
import { useToast } from '../../../components/Toast';
import { useAddSplitSheet } from '../../../components/AddSplitSheet';
import { useAddSplitEntrySheet } from '../../../components/AddSplitEntrySheet';
import { useAddSplitPersonSheet } from '../../../components/AddSplitPersonSheet';
import { useSettleUpSheet } from '../../../components/SettleUpSheet';

export default function SplitDetail() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const currency = useCurrency();
  const { notifyChanged } = useDataRefresh();
  const { showToast } = useToast();
  const { people } = useSplitPeople();
  const { openAddSplit } = useAddSplitSheet();
  const { openAddSplitEntry } = useAddSplitEntrySheet();
  const { openAddSplitPerson } = useAddSplitPersonSheet();
  const { openSettleUp } = useSettleUpSheet();
  const [tab, setTab] = useState('entries');
  // Collapsed by default — the traced-debt list above it is the answer; this is
  // the working behind it, wanted on demand rather than as a wall of prose.
  const [workingOpen, setWorkingOpen] = useState(false);

  const {
    split,
    members,
    entries,
    settlements,
    balances,
    directDebts,
    changedAfterSettling,
    memberById,
    balanceByMemberId,
    self,
    total,
    perHead,
    myNet,
    hasSettlements,
    isOrganizer,
    isSharedWithMe,
    loading,
  } = useSplit(id);

  // Back to the list the moment this split stops existing — deleting one from
  // the edit sheet used to leave you stranded on a dead screen. Same shape as
  // app/plan/[id]/history.js's own guard, and it fires for a split deleted
  // anywhere, not just from here. Gated on `loading` so it can't trigger during
  // the fetch: useSplit now reports loading until the data for THIS id lands,
  // so `!split` here genuinely means gone rather than not-yet-arrived.
  useEffect(() => {
    if (!loading && !split) router.back();
  }, [loading, split]);

  const isClosed = split?.status === 'closed';
  // The RLS policies are the real enforcement (verified with two accounts); this
  // only decides what to show, so a wrong answer here is a cosmetic bug rather
  // than a security one. Organizer-only because someone has to be able to
  // FINISH a split when everyone else has gone quiet (Decision 6).
  const canManage = isOrganizer && !isClosed;
  const formatAmount = (n) => formatMoney(n, currency);

  // Everyone who has already handed money over — the entry sheet needs this to
  // warn before an edit shifts a settled balance (Decision 7).
  const settledMemberIds = useMemo(
    () => [...new Set(settlements.flatMap((s) => [s.fromMemberId, s.toMemberId]))],
    [settlements]
  );

  // Defaulting the next entry's payer to the last one used: on a trip where one
  // person pays for ten things in a row, that's nine taps saved.
  const lastPayerMemberId = entries.length ? entries[entries.length - 1].payerMemberId : null;

  const entryCtx = useMemo(
    () => ({ split, members, hasSettlements, settledMemberIds, lastPayerMemberId }),
    [split, members, hasSettlements, settledMemberIds, lastPayerMemberId]
  );

  // Mine first, always. The number you opened the screen for is your own.
  const mineFirst = (list) => {
    const mine = list.filter(
      (p) => memberById[p.fromMemberId]?.isSelf || memberById[p.toMemberId]?.isSelf
    );
    return [...mine, ...list.filter((p) => !mine.includes(p))];
  };
  const orderedDebts = useMemo(() => mineFirst(directDebts), [directDebts, memberById]);
  // Two self-labels, and the distinction matters:
  //   IN-APP  "Chris (You)" — your own row has to be findable among five names.
  //   EXPORTS "Chris"       — a shared PDF or WhatsApp message saying "You owe
  //                           ₹1,367.60" is unattributable to whoever reads it.
  const selfLabelApp = self?.name ?? 'You';
  const selfLabelExport = self?.shortName ?? self?.name ?? 'They';

  // The on-screen answer: traced debts, grouped under whoever owes them.
  const debtGroups = useMemo(
    () => groupDebtsByDebtor({ members, debts: directDebts, selfName: selfLabelApp }),
    [members, directDebts, selfLabelApp]
  );
  const myGroup = debtGroups.find((g) => g.isSelf) ?? null;
  // NO selfName here, deliberately — that's what selects first person, so the
  // accordion addresses the reader ("You pay … and are owed …"). The group cards
  // above still show "Chris (You)", because there the subject is a name.
  const explanations = useMemo(
    () => explainBalances({ members, debts: directDebts, formatAmount }),
    [members, directDebts, currency]
  );
  // The receipt side: who collects, and from whom. Every debt appears in both
  // this and debtGroups — deliberately, because "what do I pay" and "what am I
  // owed" are different questions and the second had no home at all.
  const creditGroups = useMemo(
    () => groupCreditsByCreditor({ members, debts: directDebts, selfName: selfLabelApp }),
    [members, directDebts, selfLabelApp]
  );
  // Rebuilt for documents, where nobody is "you".
  const exportGroups = useMemo(
    () => groupDebtsByDebtor({ members, debts: directDebts, selfName: selfLabelExport }),
    [members, directDebts, selfLabelExport]
  );
  const exportCreditGroups = useMemo(
    () => groupCreditsByCreditor({ members, debts: directDebts, selfName: selfLabelExport }),
    [members, directDebts, selfLabelExport]
  );
  const exportExplanations = useMemo(
    () => explainBalances({ members, debts: directDebts, formatAmount, selfName: selfLabelExport }),
    [members, directDebts, currency, selfLabelExport]
  );

  const entriesByDate = useMemo(() => {
    const groups = new Map();
    entries.forEach((e) => {
      if (!groups.has(e.occurredOn)) groups.set(e.occurredOn, []);
      groups.get(e.occurredOn).push(e);
    });
    return [...groups.entries()];
  }, [entries]);

  // "Mysore Trip (22 Aug 2026).pdf" — the split's own name and a readable date,
  // because this is what the recipient sees in their Downloads list. Formatted
  // here rather than in lib/export.js so the date goes through date-fns and the
  // account's own locale, like every other date in the app.
  const exportName = (extension) =>
    exportFilename({
      name: split?.name,
      dateLabel: split?.occurredOn ? format(parseISO(split.occurredOn), 'd MMM yyyy') : null,
      extension,
    });

  // Three formats, split by intent rather than crammed into one menu (React
  // Native's Alert only renders three buttons reliably on Android):
  //   Share  -> send it to people. Text for the group chat, PDF for a proper
  //             itemised statement anyone can open on any phone.
  //   Export -> get the data out, as a spreadsheet. Lives under the balances,
  //             not here.
  function handleShare() {
    Alert.alert(
      'Share this split',
      'Both include every entry, who paid, and who owes whom.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'As text', onPress: shareAsText },
        { text: 'As a PDF', onPress: shareAsPdf },
      ]
    );
  }

  async function shareAsText() {
    const text = buildSummaryText({
      split,
      members,
      entries,
      balances,
      debtGroups: exportGroups,
      creditGroups: exportCreditGroups,
      selfName: selfLabelExport,
      settlements,
      directDebts: orderedDebts,
      formatAmount,
      dateLabel: split?.occurredOn ? format(parseISO(split.occurredOn), 'd MMM') : null,
      formatDay: (iso) => format(parseISO(iso), 'd MMM'),
    });
    try {
      await Share.share({ message: text });
    } catch {
      // A dismissed share sheet is not an error worth a toast.
    }
  }

  async function shareAsPdf() {
    const html = buildSplitHtml({
      split,
      members,
      entries,
      balances,
      debtGroups: exportGroups,
      creditGroups: exportCreditGroups,
      selfName: selfLabelExport,
      settlements,
      directDebts: orderedDebts,
      explanations: exportExplanations,
      formatAmount,
      formatDay: (iso) => format(parseISO(iso), 'd MMM'),
    });
    // try/catch, because without one ANY throw in here became an unhandled
    // rejection inside an Alert's onPress — no share sheet, no error, nothing.
    // A silent failure is the worst outcome: it looks like the feature simply
    // doesn't exist. Surface the real message instead.
    try {
      const { unsupported, namedFallback } = await sharePdf(html, exportName('pdf'), 'Share split');
      if (unsupported) showToast({ message: "This device can't share files", variant: 'error' });
      // Says so rather than leaving you to wonder why the file is called
      // "a1b2c3d4.pdf" — the previous version failed here silently.
      else if (namedFallback) {
        showToast({ message: 'Shared, but the file kept its generated name', variant: 'info' });
      }
    } catch (error) {
      showToast({ message: `Couldn't create the PDF: ${error?.message ?? error}`, variant: 'error' });
    }
  }

  async function shareAsCsv() {
    const csv = buildSplitCsv({
      split,
      members,
      entries,
      balances,
      debtGroups: exportGroups,
      creditGroups: exportCreditGroups,
      selfName: selfLabelExport,
      settlements,
      directDebts: orderedDebts,
      explanations: exportExplanations,
    });
    // Same reasoning as shareAsPdf's — this path also writes a file and can
    // throw, and it also runs from a Pressable with nothing catching it.
    try {
      const { unsupported } = await shareCsv(exportName('csv'), csv, 'Export split');
      if (unsupported) showToast({ message: "This device can't share files", variant: 'error' });
    } catch (error) {
      showToast({ message: `Couldn't create the file: ${error?.message ?? error}`, variant: 'error' });
    }
  }

  // Invite by LINK, not by looking anyone up (Decision 3). It goes into the
  // group chat where the trip is already being planned, which is why this needs
  // no user directory, no address-book access, and no phone number at signup.
  async function handleInvite() {
    const { code, error } = await getOrCreateInvite(split.id);
    if (error || !code) {
      showToast({ message: error?.message ?? "Couldn't create an invite", variant: 'error' });
      return;
    }
    try {
      await Share.share({
        message:
          `Join "${split.name}" on FLO so we can split this properly:\n\n` +
          `flo://join/${code}\n\n` +
          `(Link works for ${INVITE_TTL_DAYS} days.)`,
      });
    } catch {
      // A dismissed share sheet isn't an error.
    }
  }

  function handleRevokeInvites() {
    Alert.alert(
      'Turn off the invite link?',
      'Anyone who already joined stays in. The link itself stops working, so you can share a fresh one.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Turn off',
          style: 'destructive',
          onPress: async () => {
            const { error } = await revokeInvites(split.id);
            if (error) return showToast({ message: error.message, variant: 'error' });
            notifyChanged();
            showToast({ message: 'Invite link turned off', variant: 'success' });
          },
        },
      ]
    );
  }

  function handleToggleClosed() {
    if (isClosed) {
      Alert.alert('Reopen this split?', 'Entries and settlements become editable again.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reopen',
          onPress: async () => {
            const { error } = await reopenSplit(split.id);
            if (error) return showToast({ message: error.message, variant: 'error' });
            notifyChanged();
            showToast({ message: 'Split reopened', variant: 'success' });
          },
        },
      ]);
      return;
    }
    Alert.alert(
      'Close this split?',
      myNet === 0
        ? 'It gets archived and the numbers are frozen. You can reopen it any time.'
        : `You're still ${myNet > 0 ? 'owed' : 'short'} ${formatAmount(Math.abs(myNet))}. Closing freezes it anyway — useful when someone is never going to pay.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close',
          onPress: async () => {
            const { error } = await closeSplit(split.id);
            if (error) return showToast({ message: error.message, variant: 'error' });
            notifyChanged();
            showToast({ message: 'Split closed', variant: 'success' });
          },
        },
      ]
    );
  }

  async function handleAddMember(personId) {
    const { error } = await addMembers(split.id, [personId]);
    if (error) return showToast({ message: error.message, variant: 'error' });
    notifyChanged();
  }

  function handleRemoveMember(member) {
    if (member.isSelf) {
      showToast({ message: "You can't leave your own split", variant: 'info' });
      return;
    }
    Alert.alert(`Remove ${member.name}?`, 'They come out of this split and every share is recalculated.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const { error } = await removeMember(member.id);
          if (error) {
            // removeMember turns the RESTRICT violation into a sentence — they
            // paid for something or owe a share, so lifting them out would
            // silently change what everyone else owes.
            showToast({ message: error.message, variant: 'error' });
            return;
          }
          notifyChanged();
          showToast({ message: `${member.name} removed`, variant: 'success' });
        },
      },
    ]);
  }

  // People who exist but aren't in this split yet.
  const addablePeople = people.filter((p) => !members.some((m) => m.personId === p.id));

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft size={20} color={colors.ink} strokeWidth={2.4} />
          </Pressable>
        </View>
        <View style={{ paddingHorizontal: spacing.xl }}>
          <Skeleton height={150} radius={radii.card} style={{ marginBottom: spacing.lg }} />
          <Skeleton height={80} radius={radii.card} />
        </View>
      </SafeAreaView>
    );
  }

  // Deleting a split leaves this screen pointed at nothing. Go back to the list
  // rather than sitting on a "no longer exists" dead end — same behaviour as
  // app/plan/[id]/history.js, and it covers deletion from the edit sheet as well
  // as a split deleted from somewhere else.
  if (!split) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={20} color={colors.ink} strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {split.name}
        </Text>
        {/* Close/reopen and edit are the organizer's, because they change the
            split for everyone. A plain member sees neither. */}
        {isOrganizer && (
          <View style={styles.headerActions}>
            <Pressable style={styles.headerButton} onPress={handleToggleClosed}>
              {isClosed ? (
                <Unlock size={17} color={colors.ink} strokeWidth={2.2} />
              ) : (
                <Lock size={17} color={colors.ink} strokeWidth={2.2} />
              )}
            </Pressable>
            <Pressable
              style={styles.headerButton}
              onPress={() =>
                openAddSplit({
                  id: split.id,
                  name: split.name,
                  icon: split.icon,
                  occurredOn: split.occurredOn,
                  planId: split.planId,
                })
              }
            >
              <Pencil size={16} color={colors.ink} strokeWidth={2.2} />
            </Pressable>
          </View>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero — the emphasis surface (colors.emphasisBg via Card's `dark`),
            never colors.ink. Your own position is the largest figure on it. */}
        <Card dark style={styles.hero}>
          <View style={styles.heroTopRow}>
            <View style={styles.rowLeft}>
              <IconTile tone="brandSolid" size={40} radius={12}>
                <CategoryIcon icon={split.icon ?? 'travel'} size={19} color={colors.brandText} strokeWidth={2} />
              </IconTile>
              <View>
                <Text style={styles.heroDate}>{format(parseISO(split.occurredOn), 'd MMM yyyy')}</Text>
                <Text style={styles.heroMeta}>
                  {entries.length === 0
                    ? `${members.length} ${members.length === 1 ? 'person' : 'people'}`
                    : `${formatAmount(total)} · ${formatAmount(perHead)} each`}
                </Text>
              </View>
            </View>
            {isClosed && <Pill label="Closed" tone="completed" />}
          </View>

          {/* Same rule as the list card: with no entries there is nothing to be
              owed and nothing settled, so the hero says so plainly instead of
              printing a confident "Settled up" over an empty split. */}
          {entries.length === 0 ? (
            <>
              <Text style={styles.heroPositionLabel}>Nothing added yet</Text>
              <Text style={styles.heroEmpty}>Add what everyone paid and this fills itself in.</Text>
            </>
          ) : (
            <>
              {/* WHAT YOU PAY is the headline, because it's the number you act
                  on — the same reason the debt cards lead with a total to pay.
                  The net is a consequence of it, not a rival to it, so it moves
                  into the sub-line next to the money coming back, where the two
                  read as one thought.
                  When you owe nothing at all there's no payment to lead with, so
                  the headline becomes what you're owed. */}
              {myGroup ? (
                <>
                  <Text style={styles.heroPositionLabel}>You pay</Text>
                  <Text style={[styles.heroPosition, { color: colors.dangerStrong }]}>
                    {formatAmount(myGroup.owesTotal)}
                  </Text>
                  {myGroup.owedTotal > 0 && (
                    <Text style={styles.heroSub}>
                      {formatAmount(myGroup.owedTotal)} comes back to you ·{' '}
                      {myNet === 0
                        ? 'all square overall'
                        : `${formatAmount(Math.abs(myNet))} ${
                            myNet < 0 ? 'out of pocket' : 'owed to you overall'
                          }`}
                    </Text>
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.heroPositionLabel}>
                    {myNet > 0 ? "You're owed" : 'All square'}
                  </Text>
                  <Text
                    style={[
                      styles.heroPosition,
                      { color: myNet > 0 ? colors.brand : staticColors.surface },
                    ]}
                  >
                    {myNet > 0 ? formatAmount(myNet) : 'Settled up'}
                  </Text>
                </>
              )}
            </>
          )}
        </Card>

        {/* Who owes whom */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Who owes whom</Text>
          {entries.length > 0 && (
            <Pressable style={styles.textAction} onPress={handleShare}>
              <Share2 size={14} color={colors.ink} strokeWidth={2.4} />
              <Text style={styles.textActionLabel}>Share</Text>
            </Pressable>
          )}
        </View>

        {/* EVERY debt, traced to whoever paid — always visible, never behind a
            "show details". This is a money feature: the person reading it needs
            to see the working, not a single collapsed figure. It's also the only
            place the ₹17 Maaz owes YOU for the auto you fronted is visible at
            all; the fewest-payments view below nets it silently into your own
            debt and never mentions it. */}
        {entries.length > 0 && debtGroups.length > 0 && (
          <>
            {/* One block per person who owes, so every debt appears exactly
                once and reads like a statement rather than a flat list of
                sentences. The group total is what they owe in full; the net line
                appears only for someone who is ALSO owed money, and is the
                figure they'd actually hand over. That net is what the separate
                "simplest way to settle" section used to show — folding it in
                here removed a whole duplicate list that showed the same pair
                two different amounts. */}
            <Text style={styles.subSectionHeading}>Who pays what</Text>
            {debtGroups.map((g) => (
              <Card key={g.memberId} style={styles.groupCard}>
                {/* Header: avatar, name, and the total right-aligned with a
                    caption under it. Captions carry the meaning so the numbers
                    can stand alone — a prose sentence in a money view reads as
                    an apology for the layout. */}
                <View style={styles.groupHeader}>
                  <View style={[styles.groupAvatar, { backgroundColor: g.color ?? colors.brand }]}>
                    <Text style={styles.groupAvatarText}>{memberInitial(g)}</Text>
                  </View>
                  <View style={styles.groupHeaderText}>
                    <Text style={[styles.groupName, g.isSelf && styles.groupNameMine]} numberOfLines={1}>
                      {g.name}
                    </Text>
                    <Text style={styles.groupCaption}>
                      {g.verb} {g.owes.length} {g.owes.length === 1 ? 'person' : 'people'}
                    </Text>
                  </View>
                  <View style={styles.groupHeaderAmount}>
                    <Text style={[styles.groupTotal, g.isSelf && styles.groupTotalMine]}>
                      {formatAmount(g.owesTotal)}
                    </Text>
                    <Text style={styles.groupCaption}>total to pay</Text>
                  </View>
                </View>

                <View style={styles.groupDivider} />

                {/* Column headers, because a bare name beside an amount doesn't
                    say which way the money goes. Under "Stephin is owed
                    ₹57.34", a row reading "Srijish ₹28.67" was being read as
                    "Srijish is owed" when it means "Srijish owes Stephin".
                    Two words of chrome remove the ambiguity entirely. */}
                <View style={styles.groupColHeader}>
                  <Text style={styles.groupColLabel}>To</Text>
                  <Text style={styles.groupColLabel}>Amount</Text>
                </View>

                {g.owes.map((d) => {
                  const involvesMe = g.isSelf || memberById[d.toMemberId]?.isSelf;
                  return (
                    <View key={d.toMemberId} style={styles.groupRow}>
                      <Text style={styles.groupRowName} numberOfLines={1}>
                        {d.toName}
                      </Text>
                      {involvesMe && !isClosed && (
                        <Pressable
                          style={styles.settlePill}
                          onPress={() =>
                            openSettleUp({
                              split,
                              from: memberById[g.memberId],
                              to: memberById[d.toMemberId],
                              suggestedAmount: d.amount,
                            })
                          }
                        >
                          <Text style={styles.settlePillText}>Settle</Text>
                        </Pressable>
                      )}
                      <Text style={styles.groupRowAmount}>{formatAmount(d.amount)}</Text>
                    </View>
                  );
                })}

                {/* NO net figure in this card, deliberately. The card answers
                    one question — how much does this person pay, and to whom —
                    and the header total is the answer. A "net to pay" line
                    directly under a "total to pay" header put two different
                    numbers behind the same words, and only one of them is what
                    you actually hand over: you really do owe Abishek ₹1,367.60,
                    and Maaz separately owes you ₹17.
                    Netting is a different question — your out-of-pocket
                    position — and it belongs to the hero, which is about you,
                    with the per-person arithmetic in the accordion below. */}
                {/* No "also owed ₹34" aside here any more — "Who is owed" below
                    is that fact's proper home, with its own card and total. */}

                {changedAfterSettling.includes(g.memberId) && (
                  <View style={styles.changedRow}>
                    <AlertTriangle size={12} color={colors.warn} strokeWidth={2.4} />
                    <Text style={styles.changedText}>Changed after settling</Text>
                  </View>
                )}
              </Card>
            ))}

            {/* WHO IS OWED — the mirror. Without it the screen only answered
                "what do I pay": the person owed the most in the split had no
                block of their own, and someone like Stephin (who paid AND is
                owed) had their credit reduced to a muted aside. */}
            {creditGroups.length > 0 && (
              <>
                <Text style={styles.subSectionHeading}>Who is owed</Text>
                {creditGroups.map((c) => (
                  <Card key={`credit-${c.memberId}`} style={styles.groupCard}>
                    <View style={styles.groupHeader}>
                      <View style={[styles.groupAvatar, { backgroundColor: c.color ?? colors.brand }]}>
                        <Text style={styles.groupAvatarText}>{memberInitial(c)}</Text>
                      </View>
                      <View style={styles.groupHeaderText}>
                        <Text style={styles.groupName} numberOfLines={1}>
                          {c.name}
                        </Text>
                        <Text style={styles.groupCaption}>
                          owed by {c.owedBy.length} {c.owedBy.length === 1 ? 'person' : 'people'}
                        </Text>
                      </View>
                      <View style={styles.groupHeaderAmount}>
                        <Text style={[styles.groupTotal, c.isSelf && styles.groupTotalCredit]}>
                          {formatAmount(c.owedTotal)}
                        </Text>
                        <Text style={styles.groupCaption}>to collect</Text>
                      </View>
                    </View>

                    <View style={styles.groupDivider} />

                    <View style={styles.groupColHeader}>
                      <Text style={styles.groupColLabel}>From</Text>
                      <Text style={styles.groupColLabel}>Amount</Text>
                    </View>

                    {c.owedBy.map((d) => {
                      const involvesMe = c.isSelf || memberById[d.fromMemberId]?.isSelf;
                      return (
                        <View key={d.fromMemberId} style={styles.groupRow}>
                          <Text style={styles.groupRowName} numberOfLines={1}>
                            {d.fromName}
                          </Text>
                          {involvesMe && !isClosed && (
                            <Pressable
                              style={styles.settlePill}
                              onPress={() =>
                                openSettleUp({
                                  split,
                                  from: memberById[d.fromMemberId],
                                  to: memberById[c.memberId],
                                  suggestedAmount: d.amount,
                                })
                              }
                            >
                              <Text style={styles.settlePillText}>Settle</Text>
                            </Pressable>
                          )}
                          <Text style={styles.groupRowAmount}>{formatAmount(d.amount)}</Text>
                        </View>
                      );
                    })}
                  </Card>
                ))}
              </>
            )}

            {/* The arithmetic in words, behind an accordion. Nobody should have
                to reverse-engineer why their figure is ₹1,333.60 and not the
                ₹1,367.60 their share came to — but they shouldn't have to read
                five sentences to see the debts either. Collapsed by default;
                the exports always include it in full. */}
            <Card style={styles.detailCard}>
              <Pressable style={styles.accordionHeader} onPress={() => setWorkingOpen((v) => !v)}>
                <Text style={styles.detailHeading}>Each person's position</Text>
                {workingOpen ? (
                  <ChevronUp size={16} color={colors.mutedMid} strokeWidth={2.4} />
                ) : (
                  <ChevronDown size={16} color={colors.mutedMid} strokeWidth={2.4} />
                )}
              </Pressable>
              {workingOpen &&
                explanations.map((e) => (
                  <Text
                    key={e.memberId}
                    style={[styles.explainText, e.memberId === self?.id && styles.explainTextMine]}
                  >
                    {e.text}
                  </Text>
                ))}
            </Card>

          </>
        )}

        {/* The only remaining flat block, and only for the states the groups
            can't express: nothing recorded yet, or nothing left to owe. */}
        {(entries.length === 0 || debtGroups.length === 0) && (
          <Card>
            <Text style={styles.emptyText}>
              {entries.length === 0
                ? 'Add an entry and the split works itself out.'
                : "Everyone's square. Nothing left to settle."}
            </Text>
          </Card>
        )}

        {/* Separate from Share on purpose: this is "get the data out", not
            "send it to someone". The CSV is a matrix — one row per entry, one
            column per person — which is the shape you check arithmetic in. */}
        {entries.length > 0 && (
          <Pressable style={styles.exportRow} onPress={shareAsCsv}>
            <FileSpreadsheet size={14} color={colors.mutedDarker} strokeWidth={2.2} />
            <Text style={styles.exportText}>Export as a spreadsheet</Text>
          </Pressable>
        )}

        {/* Tabs, not stacked sections. A real trip runs to a dozen-plus
            entries, which buried People and Settled below a long scroll. The
            hero and the balances stay pinned above — those are the answer you
            opened the screen for — and everything browsable lives behind these.
            Same segmented language as AnalyticsSegmentTabs: Pill `dark` for the
            active tab, `neutral` for the rest. */}
        <View style={styles.tabRow}>
          {[
            ['entries', 'Entries', entries.length],
            ['people', 'People', members.length],
            ['settled', 'Settled', settlements.length],
          ].map(([key, label, count]) => (
            <Pressable key={key} onPress={() => setTab(key)}>
              <Pill label={`${label} ${count}`} tone={tab === key ? 'dark' : 'neutral'} />
            </Pressable>
          ))}
        </View>

        {tab === 'entries' && !isClosed && (
          // Phase 2's other direction: things you already logged in FLO during
          // the trip, pulled in without retyping them.
          <Pressable style={styles.fromHistoryRow} onPress={() => router.push(`/split/${split.id}/history`)}>
            <ListPlus size={16} color={colors.ink} strokeWidth={2.4} />
            <Text style={styles.fromHistoryText}>Add from my transactions</Text>
          </Pressable>
        )}

        {tab === 'entries' &&
          (entries.length === 0 ? (
            <Card>
              <Text style={styles.emptyText}>Nothing recorded yet.</Text>
            </Card>
          ) : (
            entriesByDate.map(([date, dayEntries]) => (
              <View key={date}>
                <Text style={styles.dateLabel}>{format(parseISO(date), 'EEE d MMM')}</Text>
                <Card style={styles.entryCard}>
                  {dayEntries.map((entry, i) => {
                    const payer = memberById[entry.payerMemberId];
                    const myShare = self
                      ? (entry.shares.find((s) => s.memberId === self.id)?.amount ?? null)
                      : null;
                    return (
                      <Pressable
                        key={entry.id}
                        disabled={isClosed}
                        onPress={() => openAddSplitEntry(entryCtx, entry)}
                        style={[styles.entryRow, i > 0 && styles.rowDivider]}
                      >
                        <View style={{ flex: 1 }}>
                          <View style={styles.entryTitleRow}>
                            <Text style={styles.entryDescription} numberOfLines={1}>
                              {entry.description}
                            </Text>
                            {/* This entry is cross-referenced to a real
                                transaction in the user's own ledger (Phase 2),
                                so they know it's already logged and won't enter
                                it twice. Most entries are other people's
                                spending and will never have one. */}
                            {entry.transactionId && (
                              <Link2 size={13} color={colors.mutedMid} strokeWidth={2.4} />
                            )}
                          </View>
                          <Text style={styles.entrySub}>
                            {payer?.isSelf ? 'You paid' : `${payer?.name ?? 'Someone'} paid`} ·{' '}
                            {entry.shares.length} {entry.shares.length === 1 ? 'way' : 'ways'}
                            {myShare != null ? ` · your share ${formatAmount(myShare)}` : ' · not you'}
                            {entry.transactionId ? ' · in your ledger' : ''}
                          </Text>
                        </View>
                        <Text style={styles.entryAmount}>{formatAmount(entry.amount)}</Text>
                      </Pressable>
                    );
                  })}
                </Card>
              </View>
            ))
          ))}

        {/* People as a table, same row geometry as the Transactions list:
            40x40 tile, title + sub, amount right-aligned. The right column is
            what each person PAID; the sub-line is what they owe. Contributions
            here, obligations in the balances block above — two different
            questions, deliberately not mixed. */}
        {tab === 'people' && (
          <>
            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderLabel}>Person</Text>
              <Text style={styles.tableHeaderLabel}>Paid</Text>
            </View>
            <Card>
              {members.map((m, i) => {
                const bal = balanceByMemberId[m.id];
                const paid = bal?.paid ?? 0;
                return (
                  <Pressable
                    key={m.id}
                    style={[styles.personRow, i < members.length - 1 && styles.personRowBorder]}
                    onLongPress={() => canManage && handleRemoveMember(m)}
                  >
                    <View style={[styles.avatarTile, { backgroundColor: m.color ?? colors.brand }]}>
                      <Text style={styles.avatarTileText}>{memberInitial(m)}</Text>
                    </View>
                    <View style={styles.personMid}>
                      <Text style={styles.personName} numberOfLines={1}>
                        {m.name}
                        {m.role === 'organizer' ? ' · organizer' : ''}
                      </Text>
                      <Text style={styles.personSub}>
                        {entries.length === 0
                          ? 'No entries yet'
                          : `Share ${formatAmount(bal?.owed ?? 0)}`}
                        {/* Whether FLO is actually on their phone. A ghost is
                            recorded BY someone else; a joined member reports
                            their own spending. */}
                        {m.isGhost && !m.isSelf ? ' · not on FLO' : ''}
                      </Text>
                    </View>
                    <Text style={[styles.personPaid, paid === 0 && styles.personPaidZero]}>
                      {formatAmount(paid)}
                    </Text>
                  </Pressable>
                );
              })}
            </Card>

            {canManage && (
              <>
                {/* The growth mechanic, and the reason this feature is buildable
                    at one real user: a split works fine with nobody else on
                    FLO (they're just names), and gets better as people join. */}
                <Pressable style={styles.inviteRow} onPress={handleInvite}>
                  <Share2 size={15} color={colors.brandText} strokeWidth={2.4} />
                  <Text style={styles.inviteText}>Invite people to this split</Text>
                </Pressable>
                <Pressable onPress={handleRevokeInvites}>
                  <Text style={styles.revokeText}>Turn off the invite link</Text>
                </Pressable>

                <View style={styles.addPeopleWrap}>
                  {addablePeople.map((p) => (
                    <Pressable key={p.id} style={styles.addChip} onPress={() => handleAddMember(p.id)}>
                      <Plus size={13} color={colors.ink} strokeWidth={2.6} />
                      <Text style={styles.addChipText}>{p.name}</Text>
                    </Pressable>
                  ))}
                  <Pressable
                    style={styles.addChip}
                    onPress={() => openAddSplitPerson(null, (newId) => handleAddMember(newId))}
                  >
                    <UserPlus size={13} color={colors.ink} strokeWidth={2.6} />
                    <Text style={styles.addChipText}>New person</Text>
                  </Pressable>
                </View>
                {members.length > 1 && (
                  <Text style={styles.hintText}>Long-press someone to remove them.</Text>
                )}
              </>
            )}
            {isSharedWithMe && (
              <Text style={styles.hintText}>
                Only whoever created this split can add or remove people.
              </Text>
            )}
          </>
        )}

        {/* The record of money that actually moved — kept so "why did I pay
            ₹1,274?" stays answerable after a later edit. */}
        {tab === 'settled' && (
          <Card>
            {settlements.length === 0 ? (
              <Text style={styles.emptyText}>Nothing settled yet.</Text>
            ) : (
              settlements.map((s, i) => {
                const from = memberById[s.fromMemberId];
                const to = memberById[s.toMemberId];
                return (
                  <View key={s.id} style={[styles.settlementRow, i > 0 && styles.rowDivider]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.settlementText}>
                        {from?.isSelf ? 'You' : from?.name} paid {to?.isSelf ? 'you' : to?.name}
                      </Text>
                      <Text style={styles.entrySub}>
                        {format(parseISO(s.occurredOn), 'd MMM')}
                        {s.note ? ` · ${s.note}` : ''}
                        {s.transactionId ? ' · in your ledger' : ''}
                      </Text>
                    </View>
                    <Text style={styles.entryAmount}>{formatAmount(s.amount)}</Text>
                  </View>
                );
              })
            )}
          </Card>
        )}

        {isClosed && (
          <View style={styles.closedNote}>
            <Lock size={13} color={colors.mutedMid} strokeWidth={2.2} />
            <Text style={styles.closedNoteText}>
              Closed {split.closedAt ? format(new Date(split.closedAt), 'd MMM') : ''} — reopen to make changes.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* The footer follows the tab — "Add Entry" while looking at entries is
          the split's primary action, but it reads as a mismatch on the People
          tab, where the thing you actually want is another person. */}
      {!isClosed && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
          {tab === 'people' ? (
            <Button
              title="Add Person"
              onPress={() => openAddSplitPerson(null, (newId) => handleAddMember(newId))}
            />
          ) : (
            <Button title="Add Entry" onPress={() => openAddSplitEntry(entryCtx, null)} />
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
      paddingHorizontal: spacing.xl,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    headerActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginLeft: 'auto',
    },
    headerButton: {
      width: 36,
      height: 36,
      borderRadius: 11,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.display,
      letterSpacing: -0.3,
      color: colors.ink,
      flexShrink: 1,
    },
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: 60,
    },
    footer: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
    },
    hero: {
      marginBottom: spacing.lg,
      padding: spacing.xl,
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xl,
    },
    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
    },
    heroDate: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.md,
      // Sits on Card's `dark` prop — pinned, same as plans.js's own dark text.
      color: staticColors.surface,
    },
    heroMeta: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.base,
      color: staticColors.mutedMid,
      marginTop: 1,
    },
    heroPositionLabel: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.base,
      color: staticColors.mutedMid,
    },
    heroPosition: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.amount,
      letterSpacing: -0.8,
      marginTop: 2,
    },
    heroSub: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.base,
      color: staticColors.mutedMid,
      marginTop: spacing.sm,
    },
    // Sits where heroPosition's big figure would be, but reads as a prompt
    // rather than a number — nothing has been added, so there's nothing loud
    // to say. Pinned static (on Card's `dark` surface), like heroMeta.
    heroEmpty: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.md,
      color: staticColors.mutedMid,
      marginTop: 3,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.xl,
      marginBottom: spacing.md,
    },
    sectionTitle: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.heading,
      color: colors.ink,
    },
    detailCard: {
      marginBottom: spacing.lg,
      padding: spacing.xl,
    },
    // Generous padding and a full spacing.lg between cards. The previous
    // version packed a header, rows and a prose line into Card's default 16pt
    // with 8pt rows — legible but airless. Tricount's balance list works
    // because each person gets room.
    groupCard: {
      marginBottom: spacing.lg,
      padding: spacing.xl,
    },
    groupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    // Sized to FLO's own card scale, not Tricount's: 30pt avatar against
    // plans.js's 44pt IconTile for a whole plan, and fontSize.xxl for the name
    // exactly like planName. The airy LAYOUT is the borrowed idea; the type
    // scale stays the app's.
    groupAvatar: {
      width: 30,
      height: 30,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    groupAvatarText: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.base,
      // On an arbitrary person colour from CATEGORY_COLORS, several of which are
      // dark — same deliberate exception as SplitMemberChip's avatar.
      color: '#FFFFFF',
    },
    groupHeaderText: {
      flex: 1,
      gap: 2,
    },
    groupHeaderAmount: {
      alignItems: 'flex-end',
      gap: 2,
    },
    groupName: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.xxl,
      color: colors.ink,
    },
    groupNameMine: {
      color: colors.ink,
    },
    groupCaption: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.xs,
      color: colors.mutedMid,
    },
    groupTotal: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.xxl,
      color: colors.ink,
      fontVariant: ['tabular-nums'],
    },
    groupTotalMine: {
      color: colors.danger,
    },
    // Money coming TO you reads green, the same semantic the rest of the app
    // uses for income.
    groupTotalCredit: {
      color: colors.income,
    },
    subSectionHeading: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.xs,
      color: colors.mutedMid,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginTop: spacing.sm,
      marginBottom: spacing.md,
    },
    groupColHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    groupColLabel: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.xs,
      color: colors.mutedLight,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    groupDivider: {
      height: 1,
      backgroundColor: colors.borderSoft,
      marginVertical: spacing.lg,
    },
    // 13pt of vertical padding per row rather than 8 — the single biggest
    // contributor to the cramped feel.
    groupRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: 7,
    },
    groupRowName: {
      flex: 1,
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.md,
      color: colors.mutedDarker,
    },
    groupRowAmount: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.md,
      color: colors.ink,
      fontVariant: ['tabular-nums'],
    },
    settlePill: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: radii.pill,
      backgroundColor: colors.brandBg,
    },
    settlePillText: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.xs,
      color: colors.brand,
    },
    accordionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    detailHeading: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.xs,
      color: colors.mutedMid,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: spacing.sm,
    },
    explainText: {
      fontFamily: fontFamily.medium,
      fontSize: fontSize.base,
      color: colors.mutedDarker,
      lineHeight: 19,
      marginBottom: spacing.sm,
    },
    explainTextMine: {
      fontFamily: fontFamily.bold,
      color: colors.ink,
    },
    textAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderRadius: radii.pill,
      backgroundColor: colors.chipBg,
    },
    textActionLabel: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.base,
      color: colors.ink,
    },
    rowDivider: {
      borderTopWidth: 1,
      borderTopColor: colors.borderSoft,
      marginTop: spacing.sm,
      paddingTop: spacing.md,
    },
    changedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 3,
    },
    changedText: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.xs,
      color: colors.warn,
    },
    dateLabel: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.sm,
      color: colors.mutedMid,
      marginBottom: spacing.sm,
      marginTop: spacing.sm,
    },
    entryCard: {
      marginBottom: spacing.md,
      padding: spacing.lg,
    },
    entryTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    fromHistoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingVertical: spacing.md,
      marginBottom: spacing.sm,
      borderRadius: radii.card,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.chevron,
    },
    fromHistoryText: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.md,
      color: colors.ink,
    },
    entryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: 11,
    },
    entryDescription: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.xl,
      color: colors.ink,
    },
    entrySub: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.sm,
      color: colors.mutedMid,
      marginTop: 2,
    },
    entryAmount: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.xl,
      color: colors.ink,
    },
    exportRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: spacing.md,
    },
    exportText: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.base,
      color: colors.mutedDarker,
    },
    tabRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.xl,
      marginBottom: spacing.md,
    },
    tableHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xs,
      marginBottom: spacing.sm,
    },
    tableHeaderLabel: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.xs,
      color: colors.mutedMid,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    // Row geometry copied from the Transactions list (app/(tabs)/transactions.js)
    // so the two read as the same kind of table: 40x40 tile, gap spacing.md,
    // 12pt vertical padding, hairline divider between rows.
    personRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: 12,
    },
    personRowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSoft,
    },
    personMid: {
      flex: 1,
    },
    personName: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.md,
      color: colors.ink,
    },
    personSub: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.xs,
      color: colors.mutedMid,
      marginTop: 1,
    },
    personPaid: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.md,
      color: colors.ink,
    },
    // Someone who paid nothing is a normal, common case (two people on the
    // trip paid ₹0) — muting it keeps the column scannable for who actually
    // put money in.
    personPaidZero: {
      color: colors.mutedLight,
    },
    avatarTile: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarTileText: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.xl,
      // Sits on an arbitrary person colour from CATEGORY_COLORS, several of
      // which are dark — a light glyph is the only one readable across all 14.
      // Same deliberate exception as SplitMemberChip's own avatar.
      color: '#FFFFFF',
    },
    inviteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      marginTop: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: radii.pill,
      backgroundColor: colors.brand,
    },
    inviteText: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.md,
      color: colors.brandText,
    },
    revokeText: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.sm,
      color: colors.mutedMid,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    addPeopleWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    addChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: radii.pill,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.chevron,
    },
    addChipText: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.base,
      color: colors.ink,
    },
    hintText: {
      fontFamily: fontFamily.medium,
      fontSize: fontSize.xs,
      color: colors.mutedLight,
      marginTop: spacing.md,
    },
    settlementRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    settlementText: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.md,
      color: colors.ink,
    },
    closedNote: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: spacing.xl,
    },
    closedNoteText: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.sm,
      color: colors.mutedMid,
    },
    emptyText: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.md,
      color: colors.muted,
      textAlign: 'center',
    },
  });
}
