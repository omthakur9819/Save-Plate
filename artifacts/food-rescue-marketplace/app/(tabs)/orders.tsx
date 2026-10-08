import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatRupees, useMarketplace } from '@/context/MarketplaceContext';
import { useColors } from '@/hooks/useColors';

export default function PickupsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { orders, markCollected } = useMarketplace();
  const active = orders.filter((order) => !order.collected);
  const past = orders.filter((order) => order.collected);

  const confirmPickup = (id: string) => {
    Alert.alert('Pickup complete?', 'Mark this order as collected.', [
      { text: 'Not yet', style: 'cancel' },
      {
        text: 'Yes, collected',
        onPress: () => {
          markCollected(id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: (Platform.OS === 'web' ? 67 : insets.top) + 14,
          paddingHorizontal: 20,
          paddingBottom: Platform.OS === 'web' ? 104 : Math.max(insets.bottom, 12) + 96,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.eyebrow, { color: colors.secondaryForeground }]}>YOUR GOOD FINDS</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Pickups</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Your saved spot at the counter.
        </Text>

        {active.length ? (
          active.map((order, index) => (
            <View
              key={order.id}
              style={[styles.ticket, { backgroundColor: colors.card, borderColor: colors.border }]}
              testID={`pickup-order-${order.id}`}
            >
              <View style={styles.ticketTop}>
                <View style={[styles.iconBox, { backgroundColor: colors.accent }]}>
                  <Feather name="shopping-bag" size={17} color={colors.secondaryForeground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.orderName, { color: colors.foreground }]}>{order.listingName}</Text>
                  <Text style={[styles.vendor, { color: colors.mutedForeground }]}>{order.vendor}</Text>
                </View>
                <Text style={[styles.total, { color: colors.foreground }]}>{formatRupees(order.total)}</Text>
              </View>
              <View style={[styles.rule, { borderColor: colors.border }]} />
              <View style={styles.infoLine}>
                <Feather name="clock" size={14} color={colors.primary} />
                <Text style={[styles.infoText, { color: colors.foreground }]}>{order.pickupWindow}</Text>
              </View>
              <View style={styles.infoLine}>
                <Feather name="map-pin" size={14} color={colors.primary} />
                <Text style={[styles.infoText, { color: colors.foreground }]}>{order.area}</Text>
              </View>
              <View style={[styles.codeBlock, { backgroundColor: colors.accent }]}>
                <View>
                  <Text style={[styles.codeLabel, { color: colors.secondaryForeground }]}>PICKUP CODE</Text>
                  <Text style={[styles.code, { color: colors.foreground }]}>
                    {order.id.slice(-5).toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.quantity, { color: colors.secondaryForeground }]}>
                  {order.quantity} {order.quantity === 1 ? 'bag' : 'bags'}
                </Text>
              </View>
              <Pressable
                onPress={() => confirmPickup(order.id)}
                style={[styles.collectedButton, { backgroundColor: colors.foreground }]}
                accessibilityRole="button"
                testID={`mark-collected-${order.id}`}
              >
                <Feather name="check" size={15} color={colors.background} />
                <Text style={[styles.collectedText, { color: colors.background }]}>Mark as picked up</Text>
              </Pressable>
              <View style={[styles.ticketIndex, { backgroundColor: colors.background }]} />
              {index === 0 ? (
                <Text style={[styles.ticketFootnote, { color: colors.mutedForeground }]}>
                  Show this pickup code at the counter.
                </Text>
              ) : null}
            </View>
          ))
        ) : (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.accent }]}>
              <Feather name="package" size={22} color={colors.secondaryForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Your next good find is out there</Text>
            <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>
              When you reserve something nearby, your pickup details will land here.
            </Text>
          </View>
        )}

        {past.length > 0 ? (
          <>
            <Text style={[styles.pastHeading, { color: colors.foreground }]}>Picked up</Text>
            {past.map((order) => (
              <View key={order.id} style={[styles.pastRow, { borderColor: colors.border }]}>
                <View style={[styles.pastIcon, { backgroundColor: colors.accent }]}>
                  <Feather name="check" size={14} color={colors.secondaryForeground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pastName, { color: colors.foreground }]}>{order.listingName}</Text>
                  <Text style={[styles.pastVendor, { color: colors.mutedForeground }]}>{order.vendor}</Text>
                </View>
                <Text style={[styles.total, { color: colors.foreground }]}>{formatRupees(order.total)}</Text>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  eyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  title: { fontSize: 30, letterSpacing: -0.6, fontWeight: '700', marginTop: 5 },
  subtitle: { fontSize: 12, marginTop: 4, marginBottom: 23 },
  ticket: { borderWidth: 1, borderRadius: 23, padding: 16, marginBottom: 14, overflow: 'hidden' },
  ticketTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  iconBox: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  orderName: { fontSize: 14, fontWeight: '700' },
  vendor: { fontSize: 11, marginTop: 3 },
  total: { fontSize: 16, fontWeight: '800' },
  rule: { borderBottomWidth: 1, borderStyle: 'dashed', marginVertical: 14 },
  infoLine: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 9 },
  infoText: { fontSize: 12, fontWeight: '600' },
  codeBlock: { borderRadius: 15, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 },
  codeLabel: { fontSize: 8, letterSpacing: 1.1, fontWeight: '800' },
  code: { fontSize: 20, letterSpacing: 2, fontWeight: '800', marginTop: 2 },
  quantity: { fontSize: 11, fontWeight: '700' },
  collectedButton: { minHeight: 45, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 12 },
  collectedText: { fontSize: 12, fontWeight: '700' },
  ticketIndex: { position: 'absolute', width: 20, height: 20, borderRadius: 10, left: -10, top: '38%' },
  ticketFootnote: { fontSize: 9, marginTop: 10, textAlign: 'center' },
  empty: { borderWidth: 1, borderRadius: 22, padding: 23, alignItems: 'center', marginTop: 5 },
  emptyIcon: { width: 48, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '700', textAlign: 'center', marginTop: 14 },
  emptyCopy: { fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 6, maxWidth: 260 },
  pastHeading: { fontSize: 17, fontWeight: '700', marginTop: 18, marginBottom: 4 },
  pastRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, borderBottomWidth: 1 },
  pastIcon: { width: 31, height: 31, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  pastName: { fontSize: 12, fontWeight: '700' },
  pastVendor: { fontSize: 10, marginTop: 3 },
});
