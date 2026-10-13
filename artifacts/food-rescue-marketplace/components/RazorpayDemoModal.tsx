import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FoodListing, formatRupees } from '@/context/MarketplaceContext';

export interface RazorpayPaymentResult {
  paymentId: string;
  orderId: string;
  method: 'upi' | 'card' | 'netbanking';
  amount: number;
}

interface RazorpayDemoModalProps {
  visible: boolean;
  listing: FoodListing | null;
  onClose: () => void;
  onSuccess: (result: RazorpayPaymentResult) => void;
}

type TabType = 'upi' | 'card' | 'netbanking';

export function RazorpayDemoModal({
  visible,
  listing,
  onClose,
  onSuccess,
}: RazorpayDemoModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('upi');
  const [upiId, setUpiId] = useState('success@razorpay');
  const [cardNumber, setCardNumber] = useState('4111 1111 1111 1111');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvv, setCardCvv] = useState('123');
  const [selectedBank, setSelectedBank] = useState('HDFC Bank');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState('Initializing test payment...');
  const [isSuccess, setIsSuccess] = useState(false);
  const [completedPaymentId, setCompletedPaymentId] = useState('');

  if (!listing) return null;

  const totalAmount = listing.price;
  const demoOrderId = `order_${Math.random().toString(36).slice(2, 10)}`;

  const executePayment = (method: 'upi' | 'card' | 'netbanking') => {
    setIsProcessing(true);
    setProcessStep('Connecting to Razorpay Test Gateway...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setTimeout(() => {
      setProcessStep(
        method === 'upi'
          ? 'Authorizing with UPI handle...'
          : method === 'card'
            ? 'Verifying test 3D Secure / OTP...'
            : 'Connecting to Netbanking gateway...',
      );
    }, 600);

    setTimeout(() => {
      const generatedPayId = `pay_test_${Math.random().toString(36).slice(2, 12)}`;
      setCompletedPaymentId(generatedPayId);
      setIsProcessing(false);
      setIsSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setTimeout(() => {
        setIsSuccess(false);
        setIsProcessing(false);
        onSuccess({
          paymentId: generatedPayId,
          orderId: demoOrderId,
          method,
          amount: totalAmount,
        });
      }, 1200);
    }, 1500);
  };

  const handleClose = () => {
    if (isProcessing) return;
    setIsProcessing(false);
    setIsSuccess(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.container}>
          {/* Razorpay Top Banner */}
          <View style={styles.rzpHeader}>
            <View style={styles.rzpBrandRow}>
              <View style={styles.rzpLogoBadge}>
                <Text style={styles.rzpLogoR}>R</Text>
              </View>
              <View>
                <View style={styles.rzpTitleRow}>
                  <Text style={styles.rzpBrandTitle}>Razorpay</Text>
                  <View style={styles.testModeBadge}>
                    <Text style={styles.testModeText}>TEST MODE</Text>
                  </View>
                </View>
                <Text style={styles.rzpSubTitle}>Save Plate · {listing.vendor}</Text>
              </View>
            </View>

            <Pressable
              onPress={handleClose}
              disabled={isProcessing}
              hitSlop={12}
              style={styles.closeBtn}
            >
              <Feather name="x" size={18} color="#ffffff" />
            </Pressable>
          </View>

          {/* Amount Strip */}
          <View style={styles.amountStrip}>
            <View>
              <Text style={styles.amountLabel}>AMOUNT PAYABLE</Text>
              <Text style={styles.amountValue}>{formatRupees(totalAmount)}</Text>
            </View>
            <View style={styles.itemSummaryRight}>
              <Text style={styles.itemSummaryName} numberOfLines={1}>
                {listing.name}
              </Text>
              <Text style={styles.itemSummaryArea}>Pickup at {listing.area}</Text>
            </View>
          </View>

          {/* Processing / Success State Overlay */}
          {isProcessing ? (
            <View style={styles.stateOverlay}>
              <ActivityIndicator size="large" color="#0c2340" />
              <Text style={styles.processingText}>{processStep}</Text>
              <Text style={styles.processingSub}>Simulating Razorpay test transaction...</Text>
            </View>
          ) : isSuccess ? (
            <View style={styles.stateOverlay}>
              <View style={styles.successIconCircle}>
                <Feather name="check" size={28} color="#ffffff" />
              </View>
              <Text style={styles.successTitle}>Payment Successful!</Text>
              <Text style={styles.successId}>ID: {completedPaymentId}</Text>
              <Text style={styles.successSub}>Securing your food reservation...</Text>
            </View>
          ) : (
            <>
              {/* Payment Method Selector Tabs */}
              <View style={styles.tabsRow}>
                <Pressable
                  onPress={() => setActiveTab('upi')}
                  style={[styles.tabBtn, activeTab === 'upi' && styles.tabBtnActive]}
                >
                  <Feather
                    name="smartphone"
                    size={14}
                    color={activeTab === 'upi' ? '#0c2340' : '#6b7280'}
                  />
                  <Text
                    style={[styles.tabText, activeTab === 'upi' && styles.tabTextActive]}
                  >
                    UPI / QR
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setActiveTab('card')}
                  style={[styles.tabBtn, activeTab === 'card' && styles.tabBtnActive]}
                >
                  <Feather
                    name="credit-card"
                    size={14}
                    color={activeTab === 'card' ? '#0c2340' : '#6b7280'}
                  />
                  <Text
                    style={[styles.tabText, activeTab === 'card' && styles.tabTextActive]}
                  >
                    Test Card
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setActiveTab('netbanking')}
                  style={[
                    styles.tabBtn,
                    activeTab === 'netbanking' && styles.tabBtnActive,
                  ]}
                >
                  <Feather
                    name="globe"
                    size={14}
                    color={activeTab === 'netbanking' ? '#0c2340' : '#6b7280'}
                  />
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === 'netbanking' && styles.tabTextActive,
                    ]}
                  >
                    Netbanking
                  </Text>
                </Pressable>
              </View>

              <ScrollView
                style={styles.modalBody}
                showsVerticalScrollIndicator={false}
              >
                {/* UPI TAB */}
                {activeTab === 'upi' && (
                  <View style={styles.tabContent}>
                    <View style={styles.testBanner}>
                      <Feather name="info" size={13} color="#0c2340" />
                      <Text style={styles.testBannerText}>
                        Demo Test Mode: Click below to simulate instant UPI approval.
                      </Text>
                    </View>

                    {/* Instant Approval Fast Button */}
                    <Pressable
                      onPress={() => executePayment('upi')}
                      style={styles.instantPayBtn}
                      testID="simulate-upi-payment"
                    >
                      <View style={styles.instantPayLeft}>
                        <Feather name="zap" size={16} color="#0c2340" />
                        <View>
                          <Text style={styles.instantPayTitle}>
                            Instant UPI Simulator
                          </Text>
                          <Text style={styles.instantPaySub}>
                            Test with {upiId}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.instantPayAmount}>
                        {formatRupees(totalAmount)} →
                      </Text>
                    </Pressable>

                    {/* Custom UPI input */}
                    <Text style={styles.inputLabel}>OR ENTER ANY TEST UPI ID</Text>
                    <View style={styles.inputField}>
                      <TextInput
                        value={upiId}
                        onChangeText={setUpiId}
                        placeholder="e.g. yourname@okhdfcbank"
                        style={styles.textInput}
                        autoCapitalize="none"
                      />
                    </View>

                    {/* Popular UPI Apps Presets */}
                    <View style={styles.upiChipsRow}>
                      {['success@razorpay', 'test@okhdfcbank', 'demo@paytm'].map(
                        (handle) => (
                          <Pressable
                            key={handle}
                            onPress={() => setUpiId(handle)}
                            style={[
                              styles.upiChip,
                              upiId === handle && styles.upiChipSelected,
                            ]}
                          >
                            <Text
                              style={[
                                styles.upiChipText,
                                upiId === handle && styles.upiChipTextSelected,
                              ]}
                            >
                              {handle}
                            </Text>
                          </Pressable>
                        ),
                      )}
                    </View>

                    <Pressable
                      onPress={() => executePayment('upi')}
                      style={styles.primaryPayBtn}
                    >
                      <Feather name="lock" size={14} color="#ffffff" />
                      <Text style={styles.primaryPayText}>
                        Pay {formatRupees(totalAmount)}
                      </Text>
                    </Pressable>
                  </View>
                )}

                {/* CARD TAB */}
                {activeTab === 'card' && (
                  <View style={styles.tabContent}>
                    <View style={styles.testBanner}>
                      <Feather name="credit-card" size={13} color="#0c2340" />
                      <Text style={styles.testBannerText}>
                        Standard Razorpay Test Card prefilled below (no real charges).
                      </Text>
                    </View>

                    <Text style={styles.inputLabel}>CARD NUMBER</Text>
                    <View style={styles.inputField}>
                      <TextInput
                        value={cardNumber}
                        onChangeText={setCardNumber}
                        placeholder="4111 1111 1111 1111"
                        style={styles.textInput}
                        keyboardType="number-pad"
                      />
                      <Text style={styles.cardTypeLabel}>VISA TEST</Text>
                    </View>

                    <View style={styles.cardRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.inputLabel}>EXPIRY</Text>
                        <View style={styles.inputField}>
                          <TextInput
                            value={cardExpiry}
                            onChangeText={setCardExpiry}
                            placeholder="MM/YY"
                            style={styles.textInput}
                          />
                        </View>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.inputLabel}>CVV</Text>
                        <View style={styles.inputField}>
                          <TextInput
                            value={cardCvv}
                            onChangeText={setCardCvv}
                            placeholder="123"
                            secureTextEntry
                            style={styles.textInput}
                            keyboardType="number-pad"
                          />
                        </View>
                      </View>
                    </View>

                    <Pressable
                      onPress={() => executePayment('card')}
                      style={styles.primaryPayBtn}
                      testID="simulate-card-payment"
                    >
                      <Feather name="lock" size={14} color="#ffffff" />
                      <Text style={styles.primaryPayText}>
                        Pay {formatRupees(totalAmount)} with Test Card
                      </Text>
                    </Pressable>
                  </View>
                )}

                {/* NETBANKING TAB */}
                {activeTab === 'netbanking' && (
                  <View style={styles.tabContent}>
                    <Text style={styles.inputLabel}>POPULAR TEST BANKS</Text>
                    <View style={styles.banksGrid}>
                      {['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank'].map(
                        (bank) => {
                          const isSelected = selectedBank === bank;
                          return (
                            <Pressable
                              key={bank}
                              onPress={() => setSelectedBank(bank)}
                              style={[
                                styles.bankCard,
                                isSelected && styles.bankCardSelected,
                              ]}
                            >
                              <Feather
                                name="check-circle"
                                size={14}
                                color={isSelected ? '#0c2340' : '#d1d5db'}
                              />
                              <Text
                                style={[
                                  styles.bankText,
                                  isSelected && styles.bankTextSelected,
                                ]}
                              >
                                {bank}
                              </Text>
                            </Pressable>
                          );
                        },
                      )}
                    </View>

                    <Pressable
                      onPress={() => executePayment('netbanking')}
                      style={styles.primaryPayBtn}
                      testID="simulate-netbanking-payment"
                    >
                      <Feather name="lock" size={14} color="#ffffff" />
                      <Text style={styles.primaryPayText}>
                        Pay {formatRupees(totalAmount)} via {selectedBank}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </ScrollView>

              {/* Security Footer */}
              <View style={styles.footerNote}>
                <Feather name="shield" size={12} color="#6b7280" />
                <Text style={styles.footerNoteText}>
                  Razorpay Secured · 256-Bit SSL Encrypted Test Environment
                </Text>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 10000,
  },
  container: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  rzpHeader: {
    backgroundColor: '#0c2340',
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rzpBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rzpLogoBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#0066ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rzpLogoR: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    fontStyle: 'italic',
  },
  rzpTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rzpBrandTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  testModeBadge: {
    backgroundColor: '#fef08a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  testModeText: {
    color: '#854d0e',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  rzpSubTitle: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  amountStrip: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.6,
  },
  amountValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  itemSummaryRight: {
    alignItems: 'flex-end',
    maxWidth: '55%',
  },
  itemSummaryName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  itemSummaryArea: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#0c2340',
    fontWeight: '700',
  },
  modalBody: {
    padding: 18,
    maxHeight: 320,
  },
  tabContent: {
    gap: 12,
  },
  testBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    padding: 10,
    borderRadius: 10,
  },
  testBannerText: {
    flex: 1,
    fontSize: 11,
    color: '#1e40af',
    fontWeight: '500',
  },
  instantPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0fdf4',
    borderWidth: 1.5,
    borderColor: '#86efac',
    borderRadius: 12,
    padding: 12,
  },
  instantPayLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  instantPayTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  instantPaySub: {
    fontSize: 10,
    color: '#15803d',
    marginTop: 1,
  },
  instantPayAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#166534',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  inputField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    backgroundColor: '#f8fafc',
  },
  textInput: {
    flex: 1,
    fontSize: 12,
    color: '#0f172a',
  },
  cardTypeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0284c7',
  },
  cardRow: {
    flexDirection: 'row',
    gap: 10,
  },
  upiChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  upiChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  upiChipSelected: {
    backgroundColor: '#dbeafe',
    borderColor: '#93c5fd',
  },
  upiChipText: {
    fontSize: 10,
    color: '#475569',
  },
  upiChipTextSelected: {
    color: '#1e40af',
    fontWeight: '700',
  },
  banksGrid: {
    gap: 8,
  },
  bankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  bankCardSelected: {
    borderColor: '#0c2340',
    backgroundColor: '#f0f9ff',
  },
  bankText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  bankTextSelected: {
    color: '#0c2340',
    fontWeight: '700',
  },
  primaryPayBtn: {
    backgroundColor: '#0c2340',
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  primaryPayText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  footerNoteText: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '500',
  },
  stateOverlay: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  processingText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0c2340',
    marginTop: 8,
  },
  processingSub: {
    fontSize: 11,
    color: '#64748b',
  },
  successIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#166534',
  },
  successId: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  successSub: {
    fontSize: 11,
    color: '#16a34a',
    fontWeight: '600',
  },
});
