import React, { useEffect, useState } from "react";
import {
    Alert,
    Image,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useAppTheme } from "@/context/ThemeContext";

type VegetableProps = {
  name: string;
  image: string;
  price?: number;
  stock?: number;
  onPress: () => void;
  onUpdatePrice?: (newPrice: number) => void;
};

export const VegetableCard: React.FC<VegetableProps> = ({
  name,
  image,
  price,
  stock,
  onPress,
  onUpdatePrice,
}) => {
  const { isDark, primaryColor } = useAppTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [localPrice, setLocalPrice] = useState<string | undefined>(
    price !== undefined ? String(price) : undefined,
  );
  const [selectedQty, setSelectedQty] = useState<number>(1);

  useEffect(() => {
    setLocalPrice(price !== undefined ? String(price) : undefined);
  }, [price]);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF" }]}
      onPress={onPress}
      onLongPress={() => setIsEditing(true)}
      activeOpacity={0.9}
    >
      <Image
        source={{ uri: image || "https://via.placeholder.com/100" }}
        style={styles.image}
      />

      <View style={styles.info}>
        <Text style={[styles.name, { color: isDark ? "#E0E0E0" : "#000" }]}>
          {name}
        </Text>

        {price !== undefined && !isEditing && (
          <Text style={[styles.price, { color: primaryColor, backgroundColor: primaryColor + "20" }]}>
            ₹{price}/kg
          </Text>
        )}

        {/* Quantity quick selectors and computed price */}
        <View style={styles.qtyRow}>
          {[0.25, 0.75].map((q) => (
            <TouchableOpacity
              key={q}
              style={[
                styles.qtyChip,
                selectedQty === q ? { backgroundColor: primaryColor + '15', borderColor: primaryColor } : null,
              ]}
              onPress={() => setSelectedQty(q)}
            >
              <Text
                style={[
                  styles.qtyChipText,
                  selectedQty === q ? { color: primaryColor } : null,
                ]}
              >
                {q} kg
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {price !== undefined && (
          <Text
            style={[styles.smallComputed, { color: isDark ? "#CCC" : "#444" }]}
          >
            ₹{(price * selectedQty).toFixed(2)} for {selectedQty} kg
          </Text>
        )}

        {stock !== undefined && (
          <Text
            style={[
              styles.stock,
              { color: isDark ? "#888" : "#666" },
              stock < 5 ? styles.lowStock : null,
            ]}
          >
            {stock} kg
          </Text>
        )}

        {/* Inline editor */}
        {isEditing && (
          <View
            style={[
              styles.editor,
              { backgroundColor: isDark ? "#121212" : "#FAFAFA" },
            ]}
          >
            <TextInput
              value={localPrice}
              onChangeText={setLocalPrice}
              keyboardType="numeric"
              placeholder="Enter price (₹/kg)"
              placeholderTextColor={isDark ? "#666" : "#999"}
              style={[styles.input, { color: isDark ? "#FFF" : "#000" }]}
            />
            <View style={styles.editorRow}>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: primaryColor }]}
                onPress={() => {
                  const parsed =
                    localPrice !== undefined ? parseFloat(localPrice) : NaN;
                  if (isNaN(parsed) || parsed <= 0) {
                    Alert.alert("Invalid price", "Please enter a valid number");
                    return;
                  }
                  if (onUpdatePrice) onUpdatePrice(parsed);
                  setIsEditing(false);
                }}
              >
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cancelBtn]}
                onPress={() => {
                  setLocalPrice(
                    price !== undefined ? String(price) : undefined,
                  );
                  setIsEditing(false);
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 12,
    margin: 6,
    width: 125,
    alignItems: "center",
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  image: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginBottom: 8,
  },
  info: {
    alignItems: "center",
  },
  name: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  price: {
    fontSize: 16,
    fontWeight: "900",
    backgroundColor: "rgba(255, 140, 0, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
    overflow: "hidden",
  },
  stock: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: "600",
  },
  lowStock: {
    color: "#FF5252",
  },
  editor: {
    marginTop: 8,
    padding: 8,
    borderRadius: 10,
    width: "100%",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: "100%",
    marginBottom: 8,
  },
  editorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  saveBtn: {
    backgroundColor: "#FF8C00",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  saveText: {
    color: "#FFF",
    fontWeight: "700",
  },
  cancelBtn: {
    backgroundColor: "transparent",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  cancelText: {
    color: "#666",
    fontWeight: "700",
  },
  qtyRow: {
    flexDirection: "row",
    marginTop: 6,
  },
  qtyChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EEE",
    backgroundColor: "transparent",
    marginRight: 8,
  },
  qtyChipActive: {
    backgroundColor: "#FFF3E0",
    borderColor: "#FF8C00",
  },
  qtyChipText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "700",
  },
  qtyChipTextActive: {
    color: "#FF8C00",
  },
  smallComputed: {
    fontSize: 12,
    marginTop: 6,
  },
});
