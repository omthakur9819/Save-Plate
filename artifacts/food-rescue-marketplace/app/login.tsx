import React, { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DEMO_SHOPPER,
  DEMO_VENDORS,
  FoodCategory,
  POPULAR_MUMBAI_AREAS,
  useMarketplace,
  UserProfile,
} from '@/context/MarketplaceContext';
import { useColors } from '@/hooks/useColors';

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentUser, login, logout, register, setMode } = useMarketplace();

  const [activeTab, setActiveTab] = useState<'shopper' | 'vendor'>(
    currentUser?.role || 'shopper',
  );
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [selectedArea, setSelectedArea] = useState('Bandra West');
  const [selectedCategory, setSelectedCategory] = useState<FoodCategory>('Bakery');
  const [password, setPassword] = useState('');

  const handleDemoLogin = (profile: UserProfile) => {
    login(profile);
    Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Signed in!',
      `Welcome back, ${profile.name}! Logged in as ${profile.role === 'vendor' ? `${profile.restaurantName} (Vendor)` : 'Shopper'}.`,
      [{ text: 'Continue', onPress: () => router.back() }],
    );
  };

  const handleSubmit = () => {
    if (!email.trim() || !name.trim()) {
      Alert.alert('Missing info', 'Please enter your name and email address.');
      return;
    }
    if (activeTab === 'vendor' && !restaurantName.trim()) {
      Alert.alert('Missing info', 'Please enter your restaurant/bakery name.');
      return;
    }

    const profile = register({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: activeTab,
      restaurantName: activeTab === 'vendor' ? restaurantName.trim() : undefined,
      area: selectedArea,
    });

    Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Account Ready!',
      `Logged in as ${profile.name} (${profile.role === 'vendor' ? profile.restaurantName : 'Shopper'}).`,
      [{ text: 'Start exploring', onPress: () => router.back() }],
    );
  };

  const handleLogout = () => {
    logout();
    Haptics.selectionAsync?.();
    Alert.alert('Logged out', 'You are now browsing as a guest.');
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Navigation Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top, Platform.OS === 'web' ? 20 : 10),
            backgroundColor: colors.background,
            borderColor: colors.border,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          accessibilityLabel="Back"
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Account & Authentication
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Platform.OS === 'web' ? 90 : insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* If user is already logged in, show current profile status */}
        {currentUser ? (
          <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.profileHeader}>
              <View
                style={[
                  styles.avatarBox,
                  {
                    backgroundColor: currentUser.role === 'vendor' ? colors.primary : colors.accent,
                  },
                ]}
              >
                <Feather
                  name={currentUser.role === 'vendor' ? 'briefcase' : 'user'}
                  size={24}
                  color={currentUser.role === 'vendor' ? '#FFFFFF' : colors.primary}
                />
              </View>

              <View style={styles.profileMeta}>
                <Text style={[styles.userName, { color: colors.foreground }]}>
                  {currentUser.name}
                </Text>
                <Text style={[styles.userRoleTag, { color: colors.mutedForeground }]}>
                  {currentUser.role === 'vendor'
                    ? `🏪 ${currentUser.restaurantName} (Vendor Partner)`
                    : '🛍️ Conscious Shopper'}
                </Text>
                <Text style={[styles.userEmail, { color: colors.mutedForeground }]}>
                  {currentUser.email} · {currentUser.area || 'Mumbai'}
                </Text>
              </View>
            </View>

            {currentUser.role === 'shopper' && (
              <View style={[styles.savingsBanner, { backgroundColor: colors.secondary }]}>
                <View style={styles.savingsCol}>
                  <Text style={[styles.savingsVal, { color: colors.primary }]}>
                    ₹{currentUser.savedMoneyInr || 1450}
                  </Text>
                  <Text style={[styles.savingsLbl, { color: colors.mutedForeground }]}>
                    Rupees Saved
                  </Text>
                </View>
                <View style={styles.savingsCol}>
                  <Text style={[styles.savingsVal, { color: colors.primary }]}>
                    {currentUser.mealsRescued || 8}
                  </Text>
                  <Text style={[styles.savingsLbl, { color: colors.mutedForeground }]}>
                    Meals Rescued
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.profileActions}>
              <Pressable
                onPress={() => {
                  setMode(currentUser.role === 'vendor' ? 'shopper' : 'vendor');
                  router.back();
                }}
                style={[styles.actionBtn, { backgroundColor: colors.secondary }]}
              >
                <Feather name="refresh-cw" size={14} color={colors.foreground} />
                <Text style={[styles.actionBtnText, { color: colors.foreground }]}>
                  Go to {currentUser.role === 'vendor' ? 'Shopper Feed' : 'Vendor Dashboard'}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleLogout}
                style={[styles.logoutBtn, { borderColor: colors.border }]}
              >
                <Feather name="log-out" size={14} color="#EF4444" />
                <Text style={styles.logoutBtnText}>Sign Out</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Auth Mode & Role Switcher */}
        <View style={styles.authBox}>
          <Text style={[styles.sectionHeading, { color: colors.foreground }]}>
            {currentUser ? 'Switch or Log In to Another Account' : 'Choose Account Type'}
          </Text>

          <View style={[styles.roleSwitchRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Pressable
              onPress={() => {
                setActiveTab('shopper');
                Haptics.selectionAsync?.();
              }}
              style={[
                styles.roleTab,
                activeTab === 'shopper' && { backgroundColor: colors.foreground },
              ]}
            >
              <Feather
                name="shopping-bag"
                size={15}
                color={activeTab === 'shopper' ? colors.background : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.roleTabText,
                  { color: activeTab === 'shopper' ? colors.background : colors.mutedForeground },
                ]}
              >
                Shopper / Buyer
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setActiveTab('vendor');
                Haptics.selectionAsync?.();
              }}
              style={[
                styles.roleTab,
                activeTab === 'vendor' && { backgroundColor: colors.foreground },
              ]}
            >
              <Feather
                name="briefcase"
                size={15}
                color={activeTab === 'vendor' ? colors.background : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.roleTabText,
                  { color: activeTab === 'vendor' ? colors.background : colors.mutedForeground },
                ]}
              >
                Restaurant / Vendor
              </Text>
            </Pressable>
          </View>

          {/* Quick Demo Logins Section */}
          <View style={[styles.demoSection, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <View style={styles.demoHeader}>
              <Feather name="zap" size={15} color={colors.primary} />
              <Text style={[styles.demoTitle, { color: colors.foreground }]}>
                1-Tap Instant Demo Logins
              </Text>
            </View>

            {activeTab === 'shopper' ? (
              <Pressable
                onPress={() => handleDemoLogin(DEMO_SHOPPER)}
                style={[styles.demoCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={styles.demoCardBody}>
                  <Text style={[styles.demoCardName, { color: colors.foreground }]}>
                    Continue as Aarav Sharma (Shopper)
                  </Text>
                  <Text style={[styles.demoCardMeta, { color: colors.mutedForeground }]}>
                    Bandra West · 8 meals rescued · ₹1,450 saved
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.primary} />
              </Pressable>
            ) : (
              <View style={{ gap: 8 }}>
                {DEMO_VENDORS.map((v) => (
                  <Pressable
                    key={v.id}
                    onPress={() => handleDemoLogin(v)}
                    style={[styles.demoCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <View style={styles.demoCardBody}>
                      <Text style={[styles.demoCardName, { color: colors.foreground }]}>
                        {v.restaurantName}
                      </Text>
                      <Text style={[styles.demoCardMeta, { color: colors.mutedForeground }]}>
                        Manager: {v.name} · {v.area}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={colors.primary} />
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Manual Email/Password Form */}
          <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.formTitle, { color: colors.foreground }]}>
              {isRegisterMode ? `Create New ${activeTab === 'vendor' ? 'Restaurant' : 'Shopper'} Account` : 'Sign in with credentials'}
            </Text>

            {activeTab === 'vendor' && (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>
                  Restaurant / Bakery Name *
                </Text>
                <TextInput
                  value={restaurantName}
                  onChangeText={setRestaurantName}
                  placeholder="e.g. Bandra Bread Room, The Bagel Shop..."
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.textInput, { color: colors.foreground, borderColor: colors.border }]}
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>
                {activeTab === 'vendor' ? 'Owner / Manager Name *' : 'Your Full Name *'}
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Priya Sharma"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.textInput, { color: colors.foreground, borderColor: colors.border }]}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Email Address *</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.textInput, { color: colors.foreground, borderColor: colors.border }]}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>
                Mumbai Area
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.areaChips}>
                {POPULAR_MUMBAI_AREAS.slice(0, 8).map((area) => (
                  <Pressable
                    key={area}
                    onPress={() => setSelectedArea(area)}
                    style={[
                      styles.areaPill,
                      {
                        backgroundColor: selectedArea === area ? colors.foreground : colors.secondary,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.areaPillText,
                        { color: selectedArea === area ? colors.background : colors.foreground },
                      ]}
                    >
                      {area}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
                placeholderTextColor={colors.mutedForeground}
                style={[styles.textInput, { color: colors.foreground, borderColor: colors.border }]}
              />
            </View>

            <Pressable
              onPress={handleSubmit}
              style={[styles.submitBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.submitBtnText}>
                {activeTab === 'vendor' ? 'Register Restaurant Storefront' : 'Sign In / Register'}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  content: {
    padding: 18,
  },
  profileCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  profileHeader: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  avatarBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileMeta: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: '700',
  },
  userRoleTag: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  userEmail: {
    fontSize: 11,
    marginTop: 2,
  },
  savingsBanner: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
  },
  savingsCol: {
    flex: 1,
    alignItems: 'center',
  },
  savingsVal: {
    fontSize: 17,
    fontWeight: '800',
  },
  savingsLbl: {
    fontSize: 11,
    marginTop: 2,
  },
  profileActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 10,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  logoutBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  authBox: {
    gap: 14,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
  },
  roleSwitchRow: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  roleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 10,
    borderRadius: 12,
  },
  roleTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  demoSection: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  demoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  demoTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  demoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  demoCardBody: {
    flex: 1,
  },
  demoCardName: {
    fontSize: 13,
    fontWeight: '700',
  },
  demoCardMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  formCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 14,
    marginTop: 6,
  },
  formTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  textInput: {
    height: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  areaChips: {
    gap: 6,
  },
  areaPill: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  areaPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  submitBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
