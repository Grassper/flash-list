import React, { forwardRef, ForwardedRef, useState, useCallback } from "react";
import { Text, View, Switch, StyleSheet } from "react-native";
import { FlashList, type FlashListRef } from "@shopify/flash-list";

// Define our data structure
type Item =
  | {
      type: "basic";
      title: string;
    }
  | {
      type: "footer";
      title: string;
    };

const SECTION_SIZE = 20;

const data: Item[] = Array.from({ length: 300 }, (_, index) =>
  index % SECTION_SIZE === SECTION_SIZE - 1
    ? {
        type: "footer",
        title: `Footer ${Math.floor(index / SECTION_SIZE) + 1}`,
      }
    : {
        type: "basic",
        title: `Item ${index - Math.floor(index / SECTION_SIZE) + 1}`,
      }
);

const footerIndices = data
  .map((item, index) => (item.type === "footer" ? index : null))
  .filter((item) => item !== null) as number[];

interface ToggleProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}
const Toggle = ({ label, value, onChange }: ToggleProps) => {
  return (
    <View style={styles.toggleContainer}>
      <Text>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
};

const ItemSeparator = () => {
  return <View style={styles.itemSeparator} />;
};

export const StickyFooterExample = forwardRef(
  (_: unknown, ref: ForwardedRef<unknown>) => {
    const [stickyFootersEnabled, setStickyFootersEnabled] = useState(false);

    // Memoize the renderItem function
    const renderItem = useCallback(
      ({ item }: { item: Item }) => (
        <View style={item.type === "footer" ? styles.footerItem : styles.item}>
          <Text>{item.title}</Text>
        </View>
      ),
      []
    );

    return (
      <View style={styles.container} key={`${stickyFootersEnabled}`}>
        <View>
          <Toggle
            label="Enable Sticky Footers"
            value={stickyFootersEnabled}
            onChange={setStickyFootersEnabled}
          />
        </View>
        <View style={styles.listContainer}>
          <FlashList
            ref={ref as React.RefObject<FlashListRef<Item>>}
            renderItem={renderItem}
            alwaysBounceVertical
            data={data}
            stickyFooterIndices={
              stickyFootersEnabled ? footerIndices : undefined
            }
            ItemSeparatorComponent={ItemSeparator}
          />
        </View>
      </View>
    );
  }
);
StickyFooterExample.displayName = "StickyFooterExample";

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toggleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginVertical: 8,
  },
  listContainer: {
    borderRadius: 20,
    backgroundColor: "#C0C0CC",
    margin: 16,
    overflow: "hidden",
    flex: 1,
  },
  itemSeparator: {
    height: 1,
    backgroundColor: "#CDCDCD",
  },
  footerItem: {
    height: 44,
    backgroundColor: "#40C4FFAA",
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  item: {
    height: 44,
    backgroundColor: "#E0E0E0",
    paddingHorizontal: 16,
    justifyContent: "center",
  },
});
