import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { registerRootComponent } from "expo";
import * as ImagePicker from "expo-image-picker";
import { createOrder, getProducts, saveCart, saveNewsletterSubscriber, uploadUserImage } from "./backendClient";

const products = [
  { id: 1, name: "Hand-thrown mug", category: "Home", price: 28, tag: "Bestseller", image: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=700&q=80" },
  { id: 2, name: "Linen throw", category: "Home", price: 86, tag: "New", image: "https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=700&q=80" },
  { id: 3, name: "Everyday tote", category: "Wear", price: 48, tag: "", image: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=700&q=80" },
  { id: 4, name: "Oak catchall", category: "Objects", price: 34, tag: "", image: "https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=700&q=80" },
  { id: 5, name: "Ribbed tumbler", category: "Home", price: 22, tag: "", image: "https://images.unsplash.com/photo-1577937927133-66ef06acdf18?auto=format&fit=crop&w=700&q=80" },
  { id: 6, name: "Soft cotton shirt", category: "Wear", price: 72, tag: "New", image: "https://images.unsplash.com/photo-1603252110481-7ba873bf42ab?auto=format&fit=crop&w=700&q=80" },
  { id: 7, name: "Stoneware vase", category: "Objects", price: 54, tag: "", image: "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=700&q=80" },
  { id: 8, name: "Wool house socks", category: "Wear", price: 24, tag: "", image: "https://images.unsplash.com/photo-1582966772680-860e372bb558?auto=format&fit=crop&w=700&q=80" },
];
const categories = ["All", "Home", "Wear", "Objects"];
const money = (value) => `$${value.toFixed(2)}`;

function Logo() { return <Text style={styles.logo}>nora<Text style={styles.logoDot}>.</Text></Text>; }
function Eyebrow({ children }) { return <Text style={styles.eyebrow}>{children}</Text>; }
function ActionButton({ children, onPress, disabled = false, style }) {
  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.darkButton, style, disabled && styles.disabledButton, pressed && !disabled && styles.pressed]}><Text style={styles.darkButtonText}>{children}</Text></Pressable>;
}
function ProductCard({ product, onAdd }) {
  return <View style={styles.productCard}>
    <View style={styles.productImageWrap}>
      <Image source={{ uri: product.image }} style={styles.productImage} />
      {product.tag ? <Text style={styles.productTag}>{product.tag}</Text> : null}
      <Pressable onPress={() => onAdd(product)} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}><Text style={styles.addButtonText}>Add to bag  +</Text></Pressable>
    </View>
    <View style={styles.productInfo}><View><Text style={styles.productName}>{product.name}</Text><Text style={styles.productMeta}>{product.category}</Text></View><Text style={styles.productPrice}>{money(product.price)}</Text></View>
  </View>;
}
function CartModal({ visible, cart, onClose, onRemove, onCheckout }) {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
    <View style={styles.modalBackdrop}><Pressable style={styles.modalDismiss} onPress={onClose} /><View style={styles.cartSheet}>
      <View style={styles.cartHeader}><Text style={styles.cartTitle}>Your bag <Text style={styles.cartCountLabel}>({count})</Text></Text><Pressable onPress={onClose} accessibilityLabel="Close shopping bag"><Text style={styles.closeButton}>×</Text></Pressable></View>
      <ScrollView contentContainerStyle={styles.cartList}>{cart.length ? cart.map((item) => <View style={styles.cartItem} key={item.id}><Image source={{ uri: item.image }} style={styles.cartImage} /><View style={styles.cartItemCopy}><Text style={styles.cartItemName}>{item.name}</Text><Text style={styles.cartItemMeta}>{item.quantity} × {money(item.price)}</Text></View><Pressable onPress={() => onRemove(item.id)}><Text style={styles.removeItem}>Remove</Text></Pressable></View>) : <Text style={styles.cartEmpty}>Your bag is waiting for something good.</Text>}</ScrollView>
      <View style={styles.cartFooter}><View style={styles.subtotal}><Text>Subtotal</Text><Text style={styles.subtotalPrice}>{money(total)}</Text></View><Text style={styles.cartNote}>Shipping and taxes calculated at checkout.</Text><ActionButton disabled={!cart.length} onPress={onCheckout} style={styles.checkoutButton}>Continue to checkout  →</ActionButton></View>
    </View></View>
  </Modal>;
}

export default function App() {
  const [category, setCategory] = useState("All");
  const [catalog, setCatalog] = useState(products);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState([]);
  const [email, setEmail] = useState("");
  const [newsletterMessage, setNewsletterMessage] = useState("");
  const [uploadedImage, setUploadedImage] = useState(null);
  useEffect(() => { getProducts().then((items) => { if (items?.length) setCatalog(items); }).catch(() => {}); }, []);
  useEffect(() => { saveCart(cart).catch(() => {}); }, [cart]);
  const visibleProducts = useMemo(() => catalog.filter((product) => {
    const categoryMatch = category === "All" || product.category === category;
    const searchMatch = `${product.name} ${product.category}`.toLowerCase().includes(search.toLowerCase());
    return categoryMatch && searchMatch;
  }), [category, search]);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  function addToCart(product) {
    setCart((current) => { const existing = current.find((item) => item.id === product.id); return existing ? current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...current, { ...product, quantity: 1 }]; });
    setCartOpen(true);
  }
  async function submitNewsletter() {
    if (!email.trim()) return;
    try {
      await saveNewsletterSubscriber(email.trim());
      setNewsletterMessage("You're on the list. Welcome to NORA.");
      setEmail("");
    } catch (error) {
      Alert.alert("Newsletter unavailable", error.message);
    }
  }
  async function chooseAndUploadImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo access to upload an image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (result.canceled) return;
    const asset = result.assets[0];
    try {
      await uploadUserImage(asset.uri, `${Date.now()}-${asset.fileName ?? "image.jpg"}`, asset.mimeType ?? "image/jpeg");
      setUploadedImage(asset.uri);
      Alert.alert("Image uploaded", "Your image is now stored in S3.");
    } catch (error) {
      Alert.alert("Upload unavailable", error.message);
    }
  }
  async function checkout() {
    try {
      const order = await createOrder(cart);
      setCart([]);
      setCartOpen(false);
      Alert.alert("Order saved", `Order ${order.orderId} is pending.`);
    } catch (error) {
      Alert.alert("Checkout unavailable", error.message);
    }
  }

  return <SafeAreaView style={styles.safeArea}><StatusBar barStyle="light-content" /><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView showsVerticalScrollIndicator={false}>
    <View style={styles.announcement}><Text style={styles.announcementText}>Free shipping on orders over $75 <Text style={styles.announcementDot}>•</Text> Easy 30-day returns</Text></View>
    <View style={styles.nav}><Pressable onPress={() => setMenuOpen((open) => !open)} style={styles.menuButton}><Text style={styles.menuIcon}>☰</Text></Pressable><Logo /><View style={styles.navActions}><Pressable onPress={() => setSearchOpen((open) => !open)} accessibilityLabel="Open search"><Text style={styles.navIcon}>⌕</Text></Pressable><Pressable onPress={() => setCartOpen(true)} style={styles.bagButton} accessibilityLabel="Open shopping bag"><Text style={styles.navIcon}>♧</Text>{cartCount > 0 ? <Text style={styles.cartBadge}>{cartCount}</Text> : null}</Pressable></View></View>
    {(menuOpen || searchOpen) ? <View style={styles.utilityPanel}>{menuOpen ? <View style={styles.mobileLinks}><Pressable onPress={() => setMenuOpen(false)}><Text style={styles.mobileLink}>Shop</Text></Pressable><Pressable onPress={() => setMenuOpen(false)}><Text style={styles.mobileLink}>Our story</Text></Pressable><Pressable onPress={() => setMenuOpen(false)}><Text style={styles.mobileLink}>Journal</Text></Pressable></View> : null}{searchOpen ? <TextInput autoFocus value={search} onChangeText={setSearch} placeholder="Try linen, ceramic..." placeholderTextColor="#777872" style={styles.searchInput} /> : null}</View> : null}
    <View style={styles.hero}><View style={styles.heroCopy}><Eyebrow>Made for your everyday</Eyebrow><Text style={styles.heroTitle}>Good things,{"\n"}<Text style={styles.italic}>well chosen.</Text></Text><Text style={styles.heroText}>Thoughtful objects for a calmer, more considered home. Designed to be lived with, loved, and kept.</Text><ActionButton onPress={() => {}} style={styles.heroButton}>Explore the collection  →</ActionButton></View><View style={styles.heroImageWrap}><Image source={{ uri: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=85" }} style={styles.heroImage} /><View style={styles.heroNote}><Text>01</Text><Text>Objects with intention</Text></View></View></View>
    <View style={styles.valueStrip}><View style={styles.values}><View><Text style={styles.valueNumber}>01</Text><Text style={styles.valueText}>Quietly beautiful{"\n"}design</Text></View><View><Text style={styles.valueNumber}>02</Text><Text style={styles.valueText}>Materials that{"\n"}age gracefully</Text></View><View><Text style={styles.valueNumber}>03</Text><Text style={styles.valueText}>Small-batch,{"\n"}always intentional</Text></View></View></View>
    <View style={styles.section}><View style={styles.sectionHeading}><Eyebrow>The collection</Eyebrow><Text style={styles.sectionTitle}>Find your next <Text style={styles.italic}>favorite.</Text></Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{categories.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.filter, category === item && styles.filterActive]}><Text style={[styles.filterText, category === item && styles.filterTextActive]}>{item}</Text></Pressable>)}</ScrollView><FlatList data={visibleProducts} keyExtractor={(item) => String(item.id)} numColumns={2} scrollEnabled={false} columnWrapperStyle={styles.productRow} contentContainerStyle={styles.productGrid} renderItem={({ item }) => <ProductCard product={item} onAdd={addToCart} />} ListEmptyComponent={<Text style={styles.emptyState}>No pieces found. Try another search.</Text>} /></View>
    <View style={styles.story}><Image source={{ uri: "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=1100&q=85" }} style={styles.storyImage} /><View style={styles.storyCopy}><Eyebrow>A little more meaning</Eyebrow><Text style={styles.sectionTitle}>Less, but <Text style={styles.italic}>better.</Text></Text><Text style={styles.storyText}>We believe the things around us shape how we feel. NORA brings together useful, enduring pieces from independent makers who care about the details.</Text><Pressable><Text style={styles.textLink}>Read our story  ↗</Text></Pressable></View></View>
    <View style={styles.newsletter}><View><Eyebrow>The NORA journal</Eyebrow><Text style={styles.newsletterTitle}>Notes on living{"\n"}<Text style={styles.italic}>with intention.</Text></Text></View><View style={styles.newsletterForm}><Text style={styles.newsletterLabel}>Get occasional notes, new arrivals, and good things.</Text><View style={styles.emailRow}><TextInput value={email} onChangeText={setEmail} placeholder="Your email address" placeholderTextColor="#777872" keyboardType="email-address" autoCapitalize="none" style={styles.emailInput} /><ActionButton onPress={submitNewsletter} style={styles.signUpButton}>Sign me up  →</ActionButton></View>{newsletterMessage ? <Text style={styles.formMessage}>{newsletterMessage}</Text> : null}<Pressable onPress={chooseAndUploadImage} style={styles.uploadButton}><Text style={styles.uploadButtonText}>Upload an image to your NORA space  ↑</Text></Pressable>{uploadedImage ? <Image source={{ uri: uploadedImage }} style={styles.uploadedImage} /> : null}</View></View>
    <View style={styles.footer}><Logo /><Text style={styles.footerCopy}>Thoughtful everyday goods.{"\n"}Made to stay.</Text><View style={styles.footerLinks}><Text>Shop</Text><Text>About</Text><Text>Contact</Text></View><Text style={styles.copyright}>© 2024 NORA Studio</Text></View>
  </ScrollView></KeyboardAvoidingView><CartModal visible={cartOpen} cart={cart} onClose={() => setCartOpen(false)} onRemove={(id) => setCart((current) => current.filter((item) => item.id !== id))} onCheckout={checkout} /></SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f7f5ef" }, flex: { flex: 1 }, announcement: { backgroundColor: "#20211e", paddingVertical: 9, alignItems: "center" }, announcementText: { color: "#e9e5da", fontSize: 11, letterSpacing: 0.7 }, announcementDot: { color: "#b8a991" }, nav: { height: 78, paddingHorizontal: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, logo: { color: "#20211e", fontSize: 29, fontWeight: "700", letterSpacing: -2.5 }, logoDot: { color: "#b55b3f" }, menuButton: { width: 45 }, menuIcon: { fontSize: 22, color: "#20211e" }, navActions: { flexDirection: "row", alignItems: "center", gap: 18 }, navIcon: { color: "#20211e", fontSize: 26, lineHeight: 28 }, bagButton: { position: "relative" }, cartBadge: { position: "absolute", top: -8, right: -9, backgroundColor: "#b55b3f", color: "#fff", borderRadius: 10, minWidth: 17, height: 17, textAlign: "center", fontSize: 10, paddingTop: 2 }, utilityPanel: { paddingHorizontal: 22, paddingBottom: 17 }, mobileLinks: { flexDirection: "row", gap: 24, paddingBottom: 16 }, mobileLink: { color: "#20211e", fontSize: 14 }, searchInput: { borderBottomWidth: 1, borderBottomColor: "#20211e", paddingVertical: 9, fontSize: 14, color: "#20211e" }, hero: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 52 }, heroCopy: { paddingVertical: 28, paddingHorizontal: 3 }, eyebrow: { color: "#b55b3f", textTransform: "uppercase", letterSpacing: 2, fontSize: 10, fontWeight: "700", marginBottom: 18 }, heroTitle: { color: "#20211e", fontSize: 44, lineHeight: 47, fontFamily: Platform.OS === "ios" ? "Georgia" : "serif", fontWeight: "500", letterSpacing: -1.4 }, italic: { fontStyle: "italic" }, heroText: { color: "#777872", fontSize: 15, lineHeight: 24, marginTop: 22, maxWidth: 390 }, darkButton: { backgroundColor: "#20211e", paddingHorizontal: 18, paddingVertical: 14, alignItems: "center", justifyContent: "center" }, darkButtonText: { color: "#fff", fontSize: 12, fontWeight: "600" }, heroButton: { alignSelf: "flex-start", marginTop: 25 }, pressed: { opacity: 0.78 }, disabledButton: { opacity: 0.4 }, heroImageWrap: { height: 390, position: "relative" }, heroImage: { width: "100%", height: "100%" }, heroNote: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 14, backgroundColor: "rgba(247,245,239,.9)", flexDirection: "row", justifyContent: "space-between" }, valueStrip: { backgroundColor: "#e9e4d9", paddingVertical: 25 }, values: { paddingHorizontal: 22, flexDirection: "row", justifyContent: "space-between" }, valueNumber: { color: "#b55b3f", fontSize: 10, fontWeight: "700", marginBottom: 7 }, valueText: { color: "#20211e", fontSize: 12, lineHeight: 17 }, section: { paddingHorizontal: 22, paddingTop: 65, paddingBottom: 30 }, sectionHeading: { marginBottom: 22 }, sectionTitle: { color: "#20211e", fontSize: 30, lineHeight: 34, fontFamily: Platform.OS === "ios" ? "Georgia" : "serif", fontWeight: "500", letterSpacing: -0.7 }, filters: { gap: 9, paddingBottom: 22 }, filter: { borderWidth: 1, borderColor: "#dcd9d0", paddingHorizontal: 14, paddingVertical: 8 }, filterActive: { backgroundColor: "#20211e", borderColor: "#20211e" }, filterText: { color: "#777872", fontSize: 12 }, filterTextActive: { color: "#fff" }, productGrid: { paddingBottom: 15 }, productRow: { gap: 13, marginBottom: 27 }, productCard: { flex: 1, minWidth: 0 }, productImageWrap: { aspectRatio: 0.82, backgroundColor: "#e9e4d9", position: "relative" }, productImage: { width: "100%", height: "100%" }, productTag: { position: "absolute", top: 10, left: 10, backgroundColor: "#f7f5ef", color: "#b55b3f", paddingHorizontal: 7, paddingVertical: 5, fontSize: 9, fontWeight: "700", textTransform: "uppercase" }, addButton: { position: "absolute", bottom: 9, left: 9, right: 9, backgroundColor: "rgba(32,33,30,.92)", paddingVertical: 11, alignItems: "center" }, addButtonText: { color: "#fff", fontSize: 11, fontWeight: "600" }, productInfo: { flexDirection: "row", justifyContent: "space-between", paddingTop: 10 }, productName: { color: "#20211e", fontSize: 13, marginBottom: 4 }, productMeta: { color: "#777872", fontSize: 11 }, productPrice: { color: "#20211e", fontSize: 12 }, emptyState: { color: "#777872", paddingVertical: 24, textAlign: "center" }, story: { paddingHorizontal: 22, paddingTop: 45, paddingBottom: 60 }, storyImage: { width: "100%", height: 280 }, storyCopy: { paddingTop: 30 }, storyText: { color: "#777872", fontSize: 15, lineHeight: 24, marginTop: 21, maxWidth: 420 }, textLink: { color: "#20211e", fontSize: 13, fontWeight: "600", marginTop: 23 }, newsletter: { borderTopWidth: 1, borderTopColor: "#dcd9d0", borderBottomWidth: 1, borderBottomColor: "#dcd9d0", paddingHorizontal: 22, paddingVertical: 50, gap: 30 }, newsletterTitle: { color: "#20211e", fontSize: 30, lineHeight: 34, fontFamily: Platform.OS === "ios" ? "Georgia" : "serif" }, newsletterForm: { maxWidth: 490 }, newsletterLabel: { color: "#777872", fontSize: 13, lineHeight: 20, marginBottom: 13 }, emailRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#20211e" }, emailInput: { flex: 1, color: "#20211e", paddingVertical: 12, fontSize: 13 }, signUpButton: { marginVertical: 4, paddingHorizontal: 13 }, formMessage: { color: "#b55b3f", fontSize: 12, marginTop: 12 }, uploadButton: { borderWidth: 1, borderColor: "#b55b3f", padding: 12, marginTop: 18, alignItems: "center" }, uploadButtonText: { color: "#b55b3f", fontSize: 12, fontWeight: "600" }, uploadedImage: { width: 88, height: 88, marginTop: 14 }, footer: { paddingHorizontal: 22, paddingVertical: 38, alignItems: "flex-start", gap: 18 }, footerCopy: { color: "#777872", fontSize: 12, lineHeight: 18 }, footerLinks: { flexDirection: "row", gap: 22, marginTop: 5 }, copyright: { color: "#777872", fontSize: 10, marginTop: 10 }, modalBackdrop: { flex: 1, backgroundColor: "rgba(32,33,30,.35)", justifyContent: "flex-end" }, modalDismiss: { flex: 1 }, cartSheet: { maxHeight: "84%", backgroundColor: "#f7f5ef", paddingHorizontal: 22, paddingTop: 22, paddingBottom: 18 }, cartHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 19, borderBottomWidth: 1, borderBottomColor: "#dcd9d0" }, cartTitle: { color: "#20211e", fontSize: 25, fontFamily: Platform.OS === "ios" ? "Georgia" : "serif" }, cartCountLabel: { color: "#777872", fontSize: 15 }, closeButton: { color: "#20211e", fontSize: 30, lineHeight: 30 }, cartList: { paddingVertical: 8 }, cartItem: { flexDirection: "row", alignItems: "center", paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#dcd9d0", gap: 12 }, cartImage: { width: 56, height: 56 }, cartItemCopy: { flex: 1 }, cartItemName: { color: "#20211e", fontSize: 13, marginBottom: 5 }, cartItemMeta: { color: "#777872", fontSize: 11 }, removeItem: { color: "#b55b3f", fontSize: 11 }, cartEmpty: { color: "#777872", textAlign: "center", paddingVertical: 35 }, cartFooter: { borderTopWidth: 1, borderTopColor: "#dcd9d0", paddingTop: 17 }, subtotal: { flexDirection: "row", justifyContent: "space-between", marginBottom: 7 }, subtotalPrice: { color: "#20211e", fontWeight: "700" }, cartNote: { color: "#777872", fontSize: 11, marginBottom: 14 }, checkoutButton: { width: "100%" },
});

registerRootComponent(App);
