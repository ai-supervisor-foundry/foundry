## Design: Subscription state management

### Current problems

1. Duplicate fetching: both `MainDashboard` (line 706) and `ProfileRoute` (line 1238) fetch subscription
2. State update loop: `ProfileRoute` calls `setUserTier` → parent re-renders → `ProfileRoute` recreated → `useEffect` runs again
3. Component recreation: `ProfileRoute` defined inside `MainDashboard` gets recreated on every parent re-render
4. Missing memoization: no `React.memo` or `useCallback` to prevent unnecessary re-renders

### Proposed design: single source of truth with controlled updates

#### Architecture principles

1. Single source of truth: `MainDashboard` owns subscription state
2. Unidirectional data flow: props down, callbacks up
3. Component extraction: move `ProfileRoute` outside `MainDashboard`
4. Memoization: use `React.memo` and `useCallback` to prevent re-renders
5. Deduplication: fetch subscription once, share via props

#### Implementation

```typescript
// ============================================================================
// PROFILE ROUTE COMPONENT (Extracted outside MainDashboard)
// ============================================================================

interface ProfileRouteProps {
  // Subscription data (read-only from parent)
  subscription: UserSubscription | null;
  userTier: UserTier;
  isLoadingSubscription: boolean;
  subscriptionError: string | null;
  
  // Callbacks for mutations (parent handles state updates)
  onSubscriptionRefresh: () => Promise<void>;
  onSubscriptionUpgrade: (tier: UserTier, paymentMethodId: string) => Promise<{ success: boolean; message?: string }>;
  onSubscriptionCancel: () => Promise<{ success: boolean; message?: string }>;
}

const ProfileRoute: React.FC<ProfileRouteProps> = React.memo(({
  subscription,
  userTier,
  isLoadingSubscription,
  subscriptionError,
  onSubscriptionRefresh,
  onSubscriptionUpgrade,
  onSubscriptionCancel,
}) => {
  // Local UI state only (modals, loading states for mutations)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedUpgradeTier, setSelectedUpgradeTier] = useState<UserTier | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Derived values (no API calls)
  const currentTierConfig = subscription 
    ? SUBSCRIPTION_TIERS[subscription.tier] 
    : SUBSCRIPTION_TIERS[userTier];

  const upgradeOptions = subscription 
    ? Object.values(SUBSCRIPTION_TIERS).filter(tier => 
        tier.priority > SUBSCRIPTION_TIERS[subscription.tier].priority
      )
    : [];

  // Mutation handlers call parent callbacks
  const handleUpgradeClick = (tier: UserTier) => {
    if (!isStripeAvailable()) {
      setUpgradeError('Payment processing is not available');
      return;
    }
    setSelectedUpgradeTier(tier);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = async (paymentMethodId: string) => {
    if (!selectedUpgradeTier) return;
    
    setIsUpgrading(true);
    setUpgradeError(null);
    
    try {
      const result = await onSubscriptionUpgrade(selectedUpgradeTier, paymentMethodId);
      if (result.success) {
        setShowPaymentModal(false);
        setSelectedUpgradeTier(null);
        // Parent will refresh subscription via onSubscriptionRefresh
      } else {
        setUpgradeError(result.message || 'Upgrade failed');
      }
    } catch (err: any) {
      setUpgradeError(err?.message || 'Failed to upgrade subscription');
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleCancelSubscription = async () => {
    setIsCancelling(true);
    try {
      const result = await onSubscriptionCancel();
      if (result.success) {
        setShowCancelConfirm(false);
        // Parent will refresh subscription
      } else {
        setUpgradeError(result.message || 'Failed to cancel subscription');
      }
    } catch (err: any) {
      setUpgradeError(err?.message || 'Failed to cancel subscription');
    } finally {
      setIsCancelling(false);
    }
  };

  // Render UI...
});

ProfileRoute.displayName = 'ProfileRoute';

// ============================================================================
// MAIN DASHBOARD COMPONENT (State Owner)
// ============================================================================

const MainDashboard: React.FC<MainDashboardProps> = ({ onLogout }) => {
  // ... existing state ...
  
  // Subscription state (SINGLE SOURCE OF TRUTH)
  const [userTier, setUserTier] = useState<UserTier>('freemium');
  const [userSubscription, setUserSubscription] = useState<UserSubscription | null>(null);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(true);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  
  // Refs for deduplication
  const isFetchingSubscriptionRef = useRef(false);
  const last429ErrorTimeRef = useRef<number | null>(null);
  const cooldownPeriodMs = 60000;

  // SINGLE fetchSubscription function (called once on mount, and when needed)
  const fetchSubscription = useCallback(async (force: boolean = false) => {
    // Prevent multiple simultaneous calls
    if (isFetchingSubscriptionRef.current && !force) {
      return;
    }

    // Check cooldown after 429 errors
    if (last429ErrorTimeRef.current !== null && !force) {
      const timeSinceError = Date.now() - last429ErrorTimeRef.current;
      if (timeSinceError < cooldownPeriodMs) {
        return;
      }
      if (timeSinceError >= cooldownPeriodMs) {
        last429ErrorTimeRef.current = null;
      }
    }

    try {
      isFetchingSubscriptionRef.current = true;
      setIsLoadingSubscription(true);
      setSubscriptionError(null);
      
      const sub = await apiSubscriptionService.getSubscription();
      setUserSubscription(sub);
      setUserTier(sub.tier);
      last429ErrorTimeRef.current = null;
    } catch (err: any) {
      console.error('Error fetching subscription:', err);
      const errorMessage = sanitizeErrorMessage(err?.message) || 'Failed to load subscription';
      setSubscriptionError(errorMessage);
      
      if (err?.statusCode === 429 || (err?.message && err.message.includes('Too many requests'))) {
        last429ErrorTimeRef.current = Date.now();
      }
      
      setUserTier('freemium');
    } finally {
      isFetchingSubscriptionRef.current = false;
      setIsLoadingSubscription(false);
    }
  }, []); // No dependencies - stable function

  // Fetch subscription ONCE on mount
  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Mutation callbacks (stable with useCallback)
  const handleSubscriptionUpgrade = useCallback(async (
    tier: UserTier, 
    paymentMethodId: string
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const upgradeRequest: TierUpgradeRequest = {
        targetTier: tier,
        paymentMethod: paymentMethodId,
      };
      const result = await apiSubscriptionService.upgradeSubscription(upgradeRequest);
      
      if (result.success) {
        // Refresh subscription after successful upgrade
        await fetchSubscription(true);
      }
      
      return result;
    } catch (err: any) {
      return {
        success: false,
        message: sanitizeErrorMessage(err?.message) || 'Failed to upgrade subscription',
      };
    }
  }, [fetchSubscription]);

  const handleSubscriptionCancel = useCallback(async (): Promise<{ success: boolean; message?: string }> => {
    try {
      const result = await apiSubscriptionService.cancelSubscription();
      
      if (result.success) {
        // Refresh subscription after successful cancel
        await fetchSubscription(true);
      }
      
      return result;
    } catch (err: any) {
      return {
        success: false,
        message: sanitizeErrorMessage(err?.message) || 'Failed to cancel subscription',
      };
    }
  }, [fetchSubscription]);

  // ... rest of MainDashboard ...

  return (
    <Layout>
      {/* ... */}
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/vehicles" element={<VehiclesRoute />} />
        <Route path="/properties" element={<PropertiesRoute />} />
        <Route 
          path="/profile" 
          element={
            <ProfileRoute
              subscription={userSubscription}
              userTier={userTier}
              isLoadingSubscription={isLoadingSubscription}
              subscriptionError={subscriptionError}
              onSubscriptionRefresh={fetchSubscription}
              onSubscriptionUpgrade={handleSubscriptionUpgrade}
              onSubscriptionCancel={handleSubscriptionCancel}
            />
          } 
        />
        {/* ... other routes ... */}
      </Routes>
      {/* ... */}
    </Layout>
  );
};
```

### Benefits

1. No infinite loop: `ProfileRoute` doesn't update parent state directly
2. Single fetch: subscription fetched once in `MainDashboard`
3. Stable component: `ProfileRoute` extracted and memoized, won't recreate
4. Clear data flow: props down, callbacks up
5. Better performance: memoization prevents unnecessary re-renders
6. Easier testing: `ProfileRoute` is isolated and testable
7. Type safety: explicit props interface

### Migration steps

1. Extract `ProfileRoute` outside `MainDashboard`
2. Add `ProfileRouteProps` interface
3. Remove subscription fetching from `ProfileRoute`
4. Remove `setUserTier` calls from `ProfileRoute`
5. Pass subscription state as props
6. Create mutation callbacks in `MainDashboard`
7. Wrap `ProfileRoute` with `React.memo`
8. Use `useCallback` for all callbacks

This follows React best practices and eliminates the re-render loop.