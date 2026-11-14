import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Animated, Pressable, Share, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  Pencil,
  Share2,
  Plus,
  Lock,
  Unlock,
  UserPlus,
  UserMinus,
  Link2Off,
  ListPlus,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Calculator,
} from 'lucide-react-native';
import { format, parseISO } from 'date-fns';
import ScreenHeader, { LargeTitle, useHeaderScroll } from '../../../components/ledger/ScreenHeader';
import SectionHeader from '../../../components/ledger/SectionHeader';
import ListRow from '../../../components/ledger/ListRow';
import AmountText from '../../../components/ledger/AmountText';
import AvatarStack from '../../../components/ledger/AvatarStack';
import Segmented from '../../../components/ledger/Segmented';
import Button from '../../../components/ledger/Button';
import Chip from '../../../components/ledger/Chip';
import OverflowMenu from '../../../components/ledger/OverflowMenu';
import PinnedFooter, { PINNED_FOOTER_HEIGHT } from '../../../components/ledger/PinnedFooter';
import { memberInitial } from '../../../components/SplitMemberChip';
import { useLedger, ledgerType, ledgerSpace, ledgerRadius, inter } from '../../../theme/ledger';
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
import { destructiveHaptic } from '../../../lib/haptics';
import { FLAGS } from '../../../lib/flags';

// A split, on the ledger kit (spec 48, ticket 07): a sunk band with the
// person's position and the members, "Who owes whom" as rows with Settle up on
// the pairs that involve them, the working behind a collapsible row, then
// Entries · People · Settled. Close/Reopen, Edit and (flagged) invites sit in
// the header's ⋯ menu; Share is beside it. Settle up and Add entry are pinned;
// a closed split is read-only with no footer.
export default function SplitDetail() {
  const { c } = useLedger();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { scrollY, onScroll } = useHeaderScroll();
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
            destructiveHaptic();
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
          destructiveHaptic();
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
      <View style={styles.screen}>
        <ScreenHeader title="" />
        <View style={styles.scroll}>
          <View style={[styles.skeleton, { height: 150 }]} />
          <View style={[styles.skeleton, { height: 80 }]} />
        </View>
      </View>
    );
  }

  // Deleting a split leaves this screen pointed at nothing; the effect above
  // goes back to the list.
  if (!split) return null;

  // The person's position, for the band: what they pay leads, then what
  // they're owed, then square. Same order and figures as the list
  // (lib/splitNet.js), so the two never disagree.
  let band;
  if (entries.length === 0) band = { label: 'Nothing added yet', sub: 'Add what everyone paid and this fills itself in.' };
  else if (myGroup)
    band = {
      label: 'You owe',
      value: myGroup.owesTotal,
      tone: c.ink,
      sub:
        myGroup.owedTotal > 0
          ? `${formatAmount(myGroup.owedTotal)} comes back to you · ${
              myNet === 0 ? 'all square overall' : `${formatAmount(Math.abs(myNet))} ${myNet < 0 ? 'out of pocket' : 'owed to you overall'}`
            }`
          : null,
    };
  else if (myNet > 0) band = { label: "You're owed", value: myNet, tone: c.positive };
  else band = { label: 'All square', text: 'Settled up' };

  // "Asha owes you ₹300": every traced debt, mine first.
  const nameIn = (m) => (m?.isSelf ? 'you' : m?.name ?? 'Someone');
  const nameFirst = (m) => (m?.isSelf ? 'You' : m?.name ?? 'Someone');
  const myDebt = orderedDebts.find((d) => memberById[d.fromMemberId]?.isSelf || memberById[d.toMemberId]?.isSelf);
  const settle = (d) =>
    openSettleUp({ split, from: memberById[d.fromMemberId], to: memberById[d.toMemberId], suggestedAmount: d.amount });

  const menuActions = isOrganizer
    ? [
        { key: 'close', title: isClosed ? 'Reopen split' : 'Close split', icon: isClosed ? Unlock : Lock, onPress: handleToggleClosed },
        ...(isClosed
          ? []
          : [
              {
                key: 'edit',
                title: 'Edit split',
                icon: Pencil,
                onPress: () =>
                  openAddSplit({ id: split.id, name: split.name, icon: split.icon, occurredOn: split.occurredOn, planId: split.planId }),
              },
            ]),
        ...(FLAGS.splitInvites && canManage
          ? [
              { key: 'invite', title: 'Invite people', icon: Share2, onPress: handleInvite },
              { key: 'revoke', title: 'Turn off the invite link', icon: Link2Off, onPress: handleRevokeInvites, danger: true },
            ]
          : []),
      ]
    : [];

  // Settle up (primary) + Add entry while anything involving the person is
  // owed; Add entry alone when they're square; none when the split is closed.
  let footer = null;
  if (!isClosed) {
    const addEntry = { title: 'Add entry', onPress: () => openAddSplitEntry(entryCtx, null) };
    footer = myDebt
      ? { primary: { title: 'Settle up', onPress: () => settle(myDebt) }, secondary: addEntry }
      : { primary: addEntry };
  }

  const memberIcon = (m) => (tint) => <Text style={[styles.initial, { color: tint }]}>{memberInitial(m ?? {})}</Text>;

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={split.name}
        scrollY={scrollY}
        actions={entries.length > 0 ? [{ icon: Share2, onPress: handleShare, accessibilityLabel: 'Share split' }] : []}
        trailing={menuActions.length > 0 ? <OverflowMenu title={split.name} actions={menuActions} accessibilityLabel="More for this split" /> : null}
      />
      <Animated.ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scroll, { paddingBottom: (footer ? PINNED_FOOTER_HEIGHT : 0) + ledgerSpace.section }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <LargeTitle title={split.name} scrollY={scrollY} />

        {/* The band: the person's position, largest, then the split's terms. */}
        <View style={styles.band}>
          <AvatarStack members={members} max={4} size={32} ring={c.surfaceSunk} />
          <Text style={styles.bandLabel}>{band.label}</Text>
          {band.value != null ? (
            <AmountText value={band.value} size="display" currency={currency} style={{ color: band.tone }} />
          ) : band.text ? (
            <Text style={[ledgerType.display, styles.bandText]}>{band.text}</Text>
          ) : null}
          {!!band.sub && <Text style={styles.bandSub}>{band.sub}</Text>}
          <Text style={styles.bandSub}>
            {format(parseISO(split.occurredOn), 'd MMM yyyy')}
            {entries.length > 0 ? ` · ${formatAmount(total)} · ${formatAmount(perHead)} each` : ` · ${members.length} ${members.length === 1 ? 'person' : 'people'}`}
            {isClosed ? ' · Closed' : ''}
          </Text>
        </View>

        <SectionHeader title="Who owes whom" style={styles.section} />
        {entries.length === 0 || orderedDebts.length === 0 ? (
          <Text style={styles.empty}>
            {entries.length === 0 ? 'Add an entry and the split works itself out.' : "Everyone's square. Nothing left to settle."}
          </Text>
        ) : (
          <>
            {orderedDebts.map((d, i) => {
              const from = memberById[d.fromMemberId];
              const to = memberById[d.toMemberId];
              const mine = from?.isSelf || to?.isSelf;
              const changed = changedAfterSettling.includes(d.fromMemberId);
              return (
                <ListRow
                  key={`${d.fromMemberId}-${d.toMemberId}`}
                  tone={from?.color}
                  renderIcon={memberIcon(from)}
                  title={`${nameFirst(from)} ${from?.isSelf ? 'owe' : 'owes'} ${nameIn(to)}`}
                  sub={changed ? 'Changed after settling' : undefined}
                  subColor={changed ? c.danger : undefined}
                  right={<AmountText value={d.amount} currency={currency} />}
                  trailing={
                    mine && !isClosed ? (
                      <Button title="Settle up" variant="secondary" compact onPress={() => settle(d)} style={styles.settle} />
                    ) : undefined
                  }
                  divider={i < orderedDebts.length - 1}
                />
              );
            })}

            {/* The arithmetic in words, collapsed by default; the exports
                always include it in full. */}
            <ListRow
              icon={Calculator}
              title="How this was worked out"
              trailing={workingOpen ? <ChevronUp size={18} color={c.muted} strokeWidth={1.75} /> : <ChevronDown size={18} color={c.muted} strokeWidth={1.75} />}
              onPress={() => setWorkingOpen((v) => !v)}
              accessibilityHint={workingOpen ? 'Hides the working' : 'Shows the working'}
              divider={false}
            />
            {workingOpen &&
              explanations.map((e) => (
                <Text key={e.memberId} style={[styles.explain, e.memberId === self?.id && { color: c.ink }]}>
                  {e.text}
                </Text>
              ))}

            {/* "Get the data out", apart from Share: a matrix of entries by
                person, the shape you check arithmetic in. */}
            <ListRow icon={FileSpreadsheet} title="Export as a spreadsheet" trailing="chevron" onPress={shareAsCsv} divider={false} />
          </>
        )}

        <Segmented
          accessibilityLabel="Show"
          options={[
            { value: 'entries', label: `Entries ${entries.length}` },
            { value: 'people', label: `People ${members.length}` },
            { value: 'settled', label: `Settled ${settlements.length}` },
          ]}
          value={tab}
          onChange={setTab}
          style={styles.tabs}
        />

        {tab === 'entries' && (
          <>
            {!isClosed && (
              <ListRow
                icon={ListPlus}
                title="Add from my transactions"
                trailing="chevron"
                onPress={() => router.push(`/split/${split.id}/history`)}
                divider={entries.length > 0}
              />
            )}
            {entries.length === 0 ? (
              <Text style={styles.empty}>Nothing recorded yet.</Text>
            ) : (
              entriesByDate.map(([date, dayEntries]) => (
                <View key={date}>
                  <SectionHeader title={format(parseISO(date), 'EEE d MMM')} style={styles.dateHeader} />
                  {dayEntries.map((entry, i) => {
                    const payer = memberById[entry.payerMemberId];
                    const myShare = self ? (entry.shares.find((s) => s.memberId === self.id)?.amount ?? null) : null;
                    return (
                      <ListRow
                        key={entry.id}
                        tone={payer?.color}
                        renderIcon={memberIcon(payer)}
                        title={entry.description}
                        sub={`${payer?.isSelf ? 'You paid' : `${payer?.name ?? 'Someone'} paid`} · ${
                          myShare != null ? `your share ${formatAmount(myShare)}` : 'not you'
                        }${entry.transactionId ? ' · in your ledger' : ''}`}
                        right={<AmountText value={entry.amount} currency={currency} />}
                        onPress={isClosed ? undefined : () => openAddSplitEntry(entryCtx, entry)}
                        divider={i < dayEntries.length - 1}
                      />
                    );
                  })}
                </View>
              ))
            )}
          </>
        )}

        {tab === 'people' && (
          <>
            {members.map((m, i) => {
              const bal = balanceByMemberId[m.id];
              return (
                <ListRow
                  key={m.id}
                  tone={m.color}
                  renderIcon={memberIcon(m)}
                  title={`${m.name}${m.role === 'organizer' ? ' · organizer' : ''}`}
                  sub={`${entries.length === 0 ? 'No entries yet' : `Share ${formatAmount(bal?.owed ?? 0)}`}${m.isGhost && !m.isSelf ? ' · not on FLO' : ''}`}
                  right={<AmountText value={bal?.paid ?? 0} currency={currency} />}
                  rightSub="paid"
                  trailing={
                    canManage && !m.isSelf ? (
                      <Pressable
                        onPress={() => handleRemoveMember(m)}
                        hitSlop={8}
                        style={styles.remove}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${m.name}`}
                      >
                        <UserMinus size={18} color={c.muted} strokeWidth={1.75} />
                      </Pressable>
                    ) : undefined
                  }
                  divider={i < members.length - 1}
                />
              );
            })}
            {canManage && (
              <View style={styles.chips}>
                {addablePeople.map((p) => (
                  <Chip key={p.id} label={p.name} icon={Plus} onPress={() => handleAddMember(p.id)} accessibilityLabel={`Add ${p.name}`} />
                ))}
                <Chip label="New person" icon={UserPlus} onPress={() => openAddSplitPerson(null, (newId) => handleAddMember(newId))} />
              </View>
            )}
            {isSharedWithMe && <Text style={styles.empty}>Only whoever created this split can add or remove people.</Text>}
          </>
        )}

        {tab === 'settled' &&
          (settlements.length === 0 ? (
            <Text style={styles.empty}>Nothing settled yet.</Text>
          ) : (
            settlements.map((s, i) => {
              const from = memberById[s.fromMemberId];
              const to = memberById[s.toMemberId];
              return (
                <ListRow
                  key={s.id}
                  tone={from?.color}
                  renderIcon={memberIcon(from)}
                  title={`${nameFirst(from)} paid ${nameIn(to)}`}
                  sub={`${format(parseISO(s.occurredOn), 'd MMM')}${s.note ? ` · ${s.note}` : ''}${s.transactionId ? ' · in your ledger' : ''}`}
                  right={<AmountText value={s.amount} currency={currency} />}
                  divider={i < settlements.length - 1}
                />
              );
            })
          ))}

        {isClosed && (
          <Text style={styles.empty}>
            Closed {split.closedAt ? format(new Date(split.closedAt), 'd MMM') : ''}. {isOrganizer ? 'Reopen it from ⋯ to make changes.' : ''}
          </Text>
        )}
      </Animated.ScrollView>

      {footer && <PinnedFooter primary={footer.primary} secondary={footer.secondary} />}
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.canvas,
    },
    flex: {
      flex: 1,
    },
    scroll: {
      paddingHorizontal: ledgerSpace.gutter,
    },
    skeleton: {
      borderRadius: ledgerRadius.card,
      backgroundColor: c.surfaceSunk,
      marginBottom: ledgerSpace.lg,
    },
    band: {
      backgroundColor: c.surfaceSunk,
      borderRadius: ledgerRadius.card,
      padding: ledgerSpace.lg,
      alignItems: 'center',
      gap: ledgerSpace.xs,
      marginTop: ledgerSpace.sm,
    },
    bandLabel: {
      ...ledgerType.caption,
      color: c.muted,
      marginTop: ledgerSpace.sm,
    },
    bandText: {
      color: c.ink,
    },
    bandSub: {
      ...ledgerType.caption,
      color: c.muted,
      textAlign: 'center',
    },
    section: {
      marginTop: ledgerSpace.section,
    },
    dateHeader: {
      marginTop: ledgerSpace.md,
    },
    tabs: {
      marginTop: ledgerSpace.section,
      marginBottom: ledgerSpace.sm,
    },
    initial: {
      ...ledgerType.rowTitle,
      fontFamily: inter.semibold,
    },
    settle: {
      marginLeft: ledgerSpace.sm,
    },
    remove: {
      marginLeft: ledgerSpace.sm,
      padding: ledgerSpace.xs,
    },
    explain: {
      ...ledgerType.body,
      color: c.muted,
      marginBottom: ledgerSpace.sm,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: ledgerSpace.sm,
      marginTop: ledgerSpace.md,
    },
    empty: {
      ...ledgerType.body,
      color: c.muted,
      marginTop: ledgerSpace.md,
    },
  });
}
