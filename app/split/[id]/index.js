import { useMemo, useState } from 'react';
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
import { describePayment, buildSummaryText } from '../../../lib/splitMath';
import { buildSplitCsv, shareCsv, buildSplitHtml, sharePdf } from '../../../lib/export';
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

  const {
    split,
    members,
    entries,
    settlements,
    balances,
    payments,
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
  const orderedPayments = useMemo(() => {
    const mine = payments.filter(
      (p) => memberById[p.fromMemberId]?.isSelf || memberById[p.toMemberId]?.isSelf
    );
    const theirs = payments.filter((p) => !mine.includes(p));
    return [...mine, ...theirs];
  }, [payments, memberById]);

  const entriesByDate = useMemo(() => {
    const groups = new Map();
    entries.forEach((e) => {
      if (!groups.has(e.occurredOn)) groups.set(e.occurredOn, []);
      groups.get(e.occurredOn).push(e);
    });
    return [...groups.entries()];
  }, [entries]);

  // Two formats, and the choice is worth offering rather than guessing: text
  // goes into the group chat where four people who don't have FLO can read it,
  // and CSV goes to whoever wants to check the arithmetic in a spreadsheet.
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
      payments: orderedPayments,
      settlements,
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
      payments: orderedPayments,
      settlements,
      formatAmount,
      formatDay: (iso) => format(parseISO(iso), 'd MMM'),
    });
    const { unsupported } = await sharePdf(html, 'Share split');
    if (unsupported) showToast({ message: "This device can't share files", variant: 'error' });
  }

  async function shareAsCsv() {
    const csv = buildSplitCsv({
      split,
      members,
      entries,
      balances,
      payments: orderedPayments,
      settlements,
    });
    // Spaces out of the filename — it travels through a share sheet and into
    // other apps' file pickers.
    const safeName = split.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
    const { unsupported } = await shareCsv(
      `${safeName || 'split'}-${split.occurredOn}.csv`,
      csv,
      'Export split'
    );
    if (unsupported) {
      showToast({ message: "This device can't share files", variant: 'error' });
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

  if (!split) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft size={20} color={colors.ink} strokeWidth={2.4} />
          </Pressable>
        </View>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>This split no longer exists.</Text>
        </View>
      </SafeAreaView>
    );
  }

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
              <Text style={styles.heroPositionLabel}>
                {myNet > 0 ? "You're owed" : myNet < 0 ? 'You owe' : 'All square'}
              </Text>
              <Text
                style={[
                  styles.heroPosition,
                  { color: myNet > 0 ? colors.brand : myNet < 0 ? colors.dangerStrong : staticColors.surface },
                ]}
              >
                {myNet === 0 ? 'Settled up' : formatAmount(Math.abs(myNet))}
              </Text>
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

        <Card>
          {entries.length === 0 ? (
            <Text style={styles.emptyText}>Add an entry and the split works itself out.</Text>
          ) : orderedPayments.length === 0 ? (
            <Text style={styles.emptyText}>Everyone's square. Nothing left to settle.</Text>
          ) : (
            orderedPayments.map((payment, i) => {
              const described = describePayment(payment, memberById, { formatAmount });
              const changed =
                changedAfterSettling.includes(payment.fromMemberId) ||
                changedAfterSettling.includes(payment.toMemberId);
              return (
                <View key={`${payment.fromMemberId}-${payment.toMemberId}`} style={[styles.balanceRow, i > 0 && styles.rowDivider]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.balanceText, described.involvesMe && styles.balanceTextMine]}>
                      {described.text}
                    </Text>
                    {changed && (
                      <View style={styles.changedRow}>
                        <AlertTriangle size={12} color={colors.warn} strokeWidth={2.4} />
                        <Text style={styles.changedText}>Changed after settling</Text>
                      </View>
                    )}
                  </View>
                  {described.involvesMe && !isClosed && (
                    <Pressable
                      style={styles.settleButton}
                      onPress={() =>
                        openSettleUp({
                          split,
                          from: memberById[payment.fromMemberId],
                          to: memberById[payment.toMemberId],
                          suggestedAmount: payment.amount,
                        })
                      }
                    >
                      <Text style={styles.settleButtonText}>Settle</Text>
                    </Pressable>
                  )}
                </View>
              );
            })
          )}
        </Card>

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
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
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
    balanceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    rowDivider: {
      borderTopWidth: 1,
      borderTopColor: colors.borderSoft,
      marginTop: spacing.sm,
      paddingTop: spacing.md,
    },
    balanceText: {
      fontFamily: fontFamily.semibold,
      fontSize: fontSize.md,
      color: colors.mutedDarker,
    },
    balanceTextMine: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.xl,
      color: colors.ink,
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
    settleButton: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: radii.pill,
      backgroundColor: colors.brand,
    },
    settleButtonText: {
      fontFamily: fontFamily.extrabold,
      fontSize: fontSize.base,
      color: colors.brandText,
    },
    dateLabel: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.sm,
      color: colors.mutedMid,
      marginBottom: spacing.sm,
      marginTop: spacing.sm,
    },
    entryCard: {
      marginBottom: spacing.sm,
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
      paddingVertical: spacing.sm,
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
