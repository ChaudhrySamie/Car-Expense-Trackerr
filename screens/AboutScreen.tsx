import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Linking,
  Alert,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '../hooks/useThemeColors';
import { SHADOWS, TYPOGRAPHY } from '../utils/theme';
import Header from '../components/common/Header';
import AnimatedCard from '../components/common/AnimatedCard';
import { useTranslation } from 'react-i18next';
import { checkAppVersion } from '../utils/versionCheck';
import { APP_VERSION } from '../constants/appInfo';

const LINKS = [
  {
    label: 'Portfolio Website',
    url: 'https://chaudhrysamie.netlify.app/',
    icon: 'globe-outline',
    sublabel: 'chaudhrysamie.netlify.app',
  },
  {
    label: 'LinkedIn',
    url: 'https://www.linkedin.com/in/chaudhry-samie-tahir-106b0a269/',
    icon: 'logo-linkedin',
    sublabel: 'Chaudhry Samie Tahir',
  },
  {
    label: 'Email',
    url: 'mailto:chaudhrysamie@gmail.com',
    icon: 'mail-outline',
    sublabel: 'chaudhrysamie@gmail.com',
  },
] as const;

export default function AboutScreen() {
  const navigation = useNavigation<any>();
  const { colors, isDarkMode } = useThemeColors();
  const { t } = useTranslation();

  const [versionStatus, setVersionStatus] = useState<any>(null);

  useEffect(() => {
    checkAppVersion().then(status => setVersionStatus(status));
  }, []);

  const openLink = async (url: string) => {
    if (!url) {
      Alert.alert('Error', 'No URL provided.');
      return;
    }
    let finalUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('mailto:')) {
      finalUrl = 'https://' + url;
    }
    
    try {
      const supported = await Linking.canOpenURL(finalUrl);
      if (supported) {
        await Linking.openURL(finalUrl);
      } else {
        Alert.alert('Error', `Your device cannot open this type of link: ${finalUrl}`);
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong while trying to open the link.');
    }
  };

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <Header title={t('about.title')} showBack={true} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Profile Card */}
        <AnimatedCard delay={0} style={[styles.profileCard, { backgroundColor: colors.surface }]}>
          <View style={[styles.avatarRing, { borderColor: colors.primary }]}>
            <Image
              source={require('../assets/about-pic.jpeg')}
              style={styles.avatar}
              resizeMode="cover"
            />
          </View>

          <Text style={[styles.devName, { color: colors.text }]}>Chaudhry Samie</Text>

          <View style={[styles.roleBadge, { backgroundColor: isDarkMode ? '#1e3a5f' : '#E0F2FE' }]}>
            <Ionicons name="code-slash-outline" size={14} color={colors.primary} />
            <Text style={[styles.roleText, { color: colors.primary }]}>{t('about.role')}</Text>
          </View>

          <View style={[styles.descBox, {
            backgroundColor: isDarkMode ? '#0f1f33' : '#F0F9FF',
            borderColor: isDarkMode ? '#1e3a5f' : '#BAE6FD',
          }]}>
            <Text style={[styles.descText, { color: colors.text }]}>
              {t('about.desc1_start')}
              <Text style={[styles.highlight, { color: colors.primary }]}>{t('about.desc1_highlight')}</Text>
              {t('about.desc1_end')}
            </Text>
            <Text style={[styles.descText, { color: colors.text, marginTop: 10 }]}>
              {t('about.desc2_start')}
              <Text style={[styles.highlight, { color: colors.success }]}>{t('about.desc2_highlight1')}</Text>
              {t('about.desc2_mid1')}
              <Text style={[styles.highlight, { color: colors.success }]}>{t('about.desc2_highlight2')}</Text>
              {t('about.desc2_mid2')}
              <Text style={[styles.highlight, { color: colors.success }]}>{t('about.desc2_highlight3')}</Text>
              {t('about.desc2_end')}
            </Text>
          </View>
        </AnimatedCard>

        {/* Links Section */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('about.connect')}</Text>

        {LINKS.map((link, index) => (
          <AnimatedCard
            key={link.label}
            delay={100 + index * 80}
            style={[styles.linkCard, { backgroundColor: colors.surface }]}
          >
            <TouchableOpacity onPress={() => openLink(link.url)} style={styles.linkRow} activeOpacity={0.7}>
              <View style={[styles.linkIconBox, { backgroundColor: isDarkMode ? '#1e293b' : colors.accentLight }]}>
                <Ionicons name={link.icon} size={22} color={colors.primary} />
              </View>
              <View style={styles.linkTextBox}>
                <Text style={[styles.linkLabel, { color: colors.text }]}>{link.label}</Text>
                <Text style={[styles.linkSublabel, { color: colors.textSecondary }]} numberOfLines={1}>
                  {link.sublabel}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </AnimatedCard>
        ))}

        {/* Support Section */}
        <AnimatedCard
          delay={400}
          style={[styles.supportCard, {
            backgroundColor: isDarkMode ? '#0c2d1a' : '#F0FDF4',
            borderColor: isDarkMode ? colors.success : '#BBF7D0',
          }]}
        >
          <View style={styles.supportHeader}>
            <Ionicons name="heart-outline" size={22} color={colors.success} />
            <Text style={[styles.supportTitle, { color: colors.success }]}>{t('about.support_title')}</Text>
          </View>
          <Text style={[styles.supportText, { color: colors.text }]}>
            {t('about.support_desc')}
          </Text>
          <TouchableOpacity
            style={[styles.supportBtn, { backgroundColor: colors.success }]}
            onPress={() => openLink('https://www.linkedin.com/in/chaudhry-samie-tahir-106b0a269/')}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-linkedin" size={18} color="#FFF" />
            <Text style={styles.supportBtnText}>{t('about.support_btn')}</Text>
          </TouchableOpacity>
        </AnimatedCard>

        {/* Version Check Section */}
        <AnimatedCard delay={500} style={[styles.versionCard, { backgroundColor: colors.surface }]}>
          <View style={styles.versionHeader}>
            <Text style={[styles.versionTitle, { color: colors.text }]}>{t('about.version')} {APP_VERSION}</Text>
            {!versionStatus ? (
               <ActivityIndicator size="small" color={colors.primary} />
            ) : versionStatus.status === 'upToDate' ? (
              <View style={[styles.statusBadge, { backgroundColor: isDarkMode ? '#064e3b' : '#d1fae5' }]}>
                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                <Text style={[styles.statusText, { color: colors.success }]}>{t('about.up_to_date')}</Text>
              </View>
            ) : (
              <View style={[styles.statusBadge, { backgroundColor: isDarkMode ? '#78350f' : '#fef3c7' }]}>
                <Ionicons name="alert-circle" size={14} color="#f59e0b" />
                <Text style={[styles.statusText, { color: '#f59e0b' }]}>{t('about.update_available')}</Text>
              </View>
            )}
          </View>
          {versionStatus?.status === 'updateAvailable' && (
            <View style={styles.updateInfoBox}>
              {!!versionStatus.updateMessage && (
                <Text style={[styles.updateMessage, { color: colors.textSecondary }]}>{versionStatus.updateMessage}</Text>
              )}
              {!!versionStatus.downloadUrl && (
                <TouchableOpacity
                  style={[styles.updateBtn, { backgroundColor: colors.primary }]}
                  onPress={() => openLink(versionStatus.downloadUrl)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.updateBtnText}>{t('about.update_now')}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </AnimatedCard>

        {/* Footer */}
        <View style={styles.versionRow}>
          <Text style={[styles.versionText, { color: colors.textSecondary }]}>Mile Mint v{APP_VERSION}</Text>

        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 48 },

  profileCard: {
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    marginBottom: 28,
    ...SHADOWS.medium,
  },
  avatarRing: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 3,
    padding: 3,
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.soft,
  },
  avatar: {
    width: 108,
    height: 108,
    borderRadius: 54,
  },
  devName: {
    ...TYPOGRAPHY.h2,
    fontSize: 22,
    marginBottom: 8,
    textAlign: 'center',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 20,
  },
  roleText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700' as any,
    marginLeft: 6,
  },
  descBox: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    width: '100%',
  },
  descText: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  highlight: { fontWeight: '700' as any },

  sectionTitle: {
    ...TYPOGRAPHY.h3,
    marginBottom: 14,
    paddingLeft: 4,
  },

  linkCard: {
    borderRadius: 20,
    marginBottom: 12,
    ...SHADOWS.soft,
    overflow: 'hidden',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  linkIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  linkTextBox: { flex: 1 },
  linkLabel: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    marginBottom: 2,
  },
  linkSublabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
  },

  supportCard: {
    borderRadius: 24,
    padding: 22,
    marginTop: 8,
    marginBottom: 24,
    borderWidth: 1.5,
    ...SHADOWS.soft,
  },
  supportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  supportTitle: {
    ...TYPOGRAPHY.h3,
    marginLeft: 10,
  },
  supportText: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },
  supportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    ...SHADOWS.soft,
  },
  supportBtnText: {
    color: '#FFF',
    ...TYPOGRAPHY.h3,
    fontSize: 15,
    marginLeft: 8,
  },

  versionCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    ...SHADOWS.soft,
  },
  versionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  versionTitle: {
    ...TYPOGRAPHY.h3,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700' as any,
    marginLeft: 4,
  },
  updateInfoBox: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  updateMessage: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    marginBottom: 12,
  },
  updateBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateBtnText: {
    ...TYPOGRAPHY.h3,
    color: '#FFF',
    fontSize: 15,
  },

  versionRow: { alignItems: 'center' },
  versionText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
  },
});
