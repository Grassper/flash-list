/**
 * StickyHeaders component manages the sticky header behavior in a FlashList.
 * It handles the animation and positioning of headers that should remain fixed
 * at the top of the list while scrolling.
 */

import React, {
  useRef,
  useState,
  useMemo,
  useImperativeHandle,
  useCallback,
  useEffect,
} from "react";
import { Animated, NativeScrollEvent } from "react-native";

import { FlashListProps } from "../..";
import { PlatformConfig } from "../../native/config/PlatformHelper";
import { RecyclerViewManager } from "../RecyclerViewManager";
import { ViewHolder } from "../ViewHolder";
import { CompatAnimatedView } from "./CompatView";

/**
 * Props for the StickyHeaders component
 * @template TItem - The type of items in the list
 */
export interface StickyFooterProps<TItem> {
  /** Array of indices that should have sticky footers */
  stickyFooterIndices: number[];
  /** Offset from the top where sticky footer should stick (in pixels) */
  stickyFooterOffset: number;
  /** Sticky footer change handler */
  onChangeStickyIndex: (index: number) => void;
  /** The data array being rendered */
  data: ReadonlyArray<TItem>;
  /** Animated value tracking scroll position */
  scrollY: Animated.Value;
  /** Function to render each item */
  renderItem: FlashListProps<TItem>["renderItem"];
  /** Ref to access sticky header methods */
  StickyFooterRef: React.RefObject<StickyFooterRef>;
  /** Manager for recycler view operations */
  recyclerViewManager: RecyclerViewManager<TItem>;
  /** Additional data to trigger re-renders */
  extraData: FlashListProps<TItem>["extraData"];
}

/**
 * Ref interface for StickyHeaders component
 */
export interface StickyFooterRef {
  /** Reports scroll events to update sticky header positions */
  reportScrollEvent: (event: NativeScrollEvent) => void;
}

interface StickyHeaderState {
  currentStickyIndex: number;
  pushStartsAt: number;
}

export const StickyFooters = <TItem,>({
  stickyFooterIndices,
  stickyFooterOffset,
  renderItem,
  StickyFooterRef,
  recyclerViewManager,
  scrollY,
  data,
  extraData,
  onChangeStickyIndex,
}: StickyFooterProps<TItem>) => {
  const [stickyFooterState, setStickyFooterState] = useState<StickyHeaderState>(
    {
      currentStickyIndex: -1,
      pushStartsAt: Number.MAX_SAFE_INTEGER,
    },
  );

  const { currentStickyIndex, pushStartsAt } = stickyFooterState;

  // sort indices and memoize compute
  const sortedIndices = useMemo(() => {
    return [...stickyFooterIndices].sort((first, second) => first - second);
  }, [stickyFooterIndices]);

  const lengthInvalid =
    sortedIndices.length === 0 ||
    recyclerViewManager.getDataLength() <=
      sortedIndices[sortedIndices.length - 1];

  const compute = useCallback(() => {
    if (lengthInvalid) {
      return;
    }

    // will this add padding bottom to the recyclerview.
    const adjustedScrollOffset = recyclerViewManager.getLastScrollOffset();
    const windowSize = recyclerViewManager.getWindowSize();
    const bottomLine =
      adjustedScrollOffset + windowSize.height - stickyFooterOffset;
    // Binary search for current sticky index
    const currentIndexInArray = findCurrentStickyIndex(
      sortedIndices,
      // [rev-marker-flashlist] is minus-ing stickyFooterOffset is right here. considering
      // offset is zero for both header & footer.
      bottomLine,
      (index) =>
        recyclerViewManager.getLayout(index).y +
        recyclerViewManager.firstItemOffset,
      (index) => recyclerViewManager.getLayout(index).height,
    );

    const newStickyIndex = sortedIndices[currentIndexInArray] ?? -1;
    let newNextStickyIndex = sortedIndices[currentIndexInArray - 1] ?? -1;

    // [rev-marker-flashlist] what is purpose of this
    if (
      newNextStickyIndex < recyclerViewManager.getEngagedIndices().startIndex
    ) {
      newNextStickyIndex = -1;
    }

    const newCurrentStickyHeight =
      recyclerViewManager.tryGetLayout(newStickyIndex)?.height ?? 0;

    // Calculate when the next sticky footer should start pushing the current one
    // The next footer starts pushing when it reaches the top of the current sticky footer
    const newNextStickyY =
      newNextStickyIndex === -1
        ? Number.MIN_SAFE_INTEGER
        : (recyclerViewManager.tryGetLayout(newNextStickyIndex)?.y ?? 0) +
          recyclerViewManager.firstItemOffset;

    // Push should start when the next footer reaches the top of the current sticky footer.
    // [rev-marker-flashlist] it is confusing have to verify
    const prevHeight =
      newNextStickyIndex === -1
        ? 0
        : (recyclerViewManager.tryGetLayout(newNextStickyIndex)?.height ?? 0);

    // bottom of previous footer (content space)
    const prevBottom = newNextStickyY + prevHeight;

    // push must start when prevBottom reaches top of sticky footer area
    const newPushStartsAt =
      newNextStickyIndex === -1
        ? Number.MIN_SAFE_INTEGER
        : prevBottom -
          (windowSize.height - stickyFooterOffset - newCurrentStickyHeight);

    console.log("[Marker flashlist] footer", {
      newPushStartsAt,
      stickyFooterState,
    });

    if (
      newStickyIndex !== currentStickyIndex ||
      newPushStartsAt !== pushStartsAt
    ) {
      setStickyFooterState({
        currentStickyIndex: newStickyIndex,
        // [rev-marker-flashlist] it is confusing have to verify
        pushStartsAt: newPushStartsAt,
      });
    }

    if (newStickyIndex !== currentStickyIndex) {
      onChangeStickyIndex?.(newStickyIndex);
    }
  }, [
    lengthInvalid,
    recyclerViewManager,
    sortedIndices,
    currentStickyIndex,
    pushStartsAt,
    onChangeStickyIndex,
    stickyFooterOffset,
  ]);

  useEffect(() => {
    compute();
  }, [compute]);

  // Optimized scroll handler using binary search pattern
  useImperativeHandle(
    StickyFooterRef,
    () => ({
      reportScrollEvent: () => {
        compute();
      },
    }),
    [compute],
  );

  const refHolder = useRef(new Map()).current;

  const { translateY, opacity } = useMemo(() => {
    const currentStickyHeight =
      recyclerViewManager.tryGetLayout(currentStickyIndex)?.height ?? 0;

    return {
      translateY: scrollY.interpolate({
        inputRange: [pushStartsAt - currentStickyHeight, pushStartsAt],
        outputRange: [currentStickyHeight, 0],
        extrapolate: "clamp",
      }),
      opacity:
        // this looks off need to check [rev-marker-flashlist]
        stickyFooterOffset > 0
          ? scrollY.interpolate({
              inputRange: [pushStartsAt - currentStickyHeight, pushStartsAt],
              outputRange: [0, 1],
              extrapolate: "clamp",
            })
          : undefined,
    };
  }, [
    recyclerViewManager,
    currentStickyIndex,
    scrollY,
    pushStartsAt,
    stickyFooterOffset,
  ]);

  //   console.log(
  //     "[Marker flashlist] footer currentStickyIndex",
  //     currentStickyIndex,
  //   );

  // Memoize header content
  const footerContent = useMemo(() => {
    return (
      <CompatAnimatedView
        style={{
          position: "absolute",
          bottom: stickyFooterOffset,
          left: 0,
          right: 0,
          zIndex: 2,
          transform: [{ translateY }],
          opacity,
        }}
      >
        {currentStickyIndex !== -1 && currentStickyIndex < data.length ? (
          <ViewHolder
            index={currentStickyIndex}
            item={data[currentStickyIndex]}
            renderItem={renderItem}
            layout={{ x: 0, y: 0, width: 0, height: 0 }}
            refHolder={refHolder}
            extraData={extraData}
            trailingItem={null}
            target="StickyHeader"
            hidden={false}
          />
        ) : null}
      </CompatAnimatedView>
    );
  }, [
    translateY,
    opacity,
    currentStickyIndex,
    data,
    renderItem,
    refHolder,
    extraData,
    stickyFooterOffset,
  ]);

  if (PlatformConfig.isRN083OrAbove && currentStickyIndex === -1) {
    return null;
  }

  return footerContent;
};

/**
 * Binary search utility to find the current sticky footer index based on scroll position
 * @param sortedIndices - Array of indices sorted by Y position
 * @param adjustedValue - Current scroll position
 * @param getY - Function to get Y position for an index
 * @returns Index of the current sticky header
 */
function findCurrentStickyIndex(
  sortedIndices: number[],
  adjustedValue: number,
  getY: (index: number) => number,
  getHeight: (index: number) => number,
): number {
  let left = 0;
  let right = sortedIndices.length - 1;
  let ans = -1;

  while (left <= right) {
    const mid = (left + right) >> 1;
    const y = getY(sortedIndices[mid]);
    const height = getHeight(sortedIndices[mid]);
    const derivedHeight = adjustedValue - height;

    if (derivedHeight <= y) {
      ans = mid;
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }
  return ans;
}
