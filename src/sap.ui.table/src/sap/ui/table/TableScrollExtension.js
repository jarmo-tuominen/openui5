/*!
 * ${copyright}
 */

// Provides helper sap.ui.table.TableScrollExtension.
sap.ui.define([
	'jquery.sap.global', './TableExtension', './TableUtils', 'sap/ui/Device', './library'
], function(jQuery, TableExtension, TableUtils, Device, library) {
	"use strict";

	// Shortcuts
	var SharedDomRef = library.SharedDomRef;

	/*
	 * Provides utility functions used by this extension.
	 */
	var ExtensionHelper = {
		onFixedAreaHorizontalScrolling: function(oEvent) {
			oEvent.target.scrollLeft = 0;
		},

		/**
		 * Will be called when scrolled horizontally. Because the table does not render/update the data of all columns (only the visible ones),
		 * we need to update the content of the columns which became visible.
		 * @param {UIEvent} oEvent The event object.
		 */
		onHorizontalScrolling: function(oEvent) {
			var oScrollExtension = this._getScrollExtension();

			// For interaction detection.
			jQuery.sap.interaction.notifyScrollEvent && jQuery.sap.interaction.notifyScrollEvent(oEvent);

			if (this._bOnAfterRendering) {
				return;
			}

			var sTableId = this.getId();
			var sHsbId = sTableId + "-" + SharedDomRef.HorizontalScrollBar;
			var sHeaderScrollId = sTableId + "-sapUiTableColHdrScr";
			var sContentScrollId = sTableId + "-sapUiTableCtrlScr";

			// Prevent that the synchronization of the scrolling positions causes subsequent synchronizations
			// due to triggering the scroll events of the other scrollable areas.
			if (oEvent.target.id === sHsbId) {
				if (oScrollExtension._bHScrollHsbBlocked) {
					oScrollExtension._bHScrollHsbBlocked = false;
					return;
				} else {
					oScrollExtension._bHScrollHeaderBlocked = true;
					oScrollExtension._bHScrollContentBlocked = true;
				}
			} else if (oEvent.target.id === sHeaderScrollId) {
				if (oScrollExtension._bHScrollHeaderBlocked) {
					oScrollExtension._bHScrollHeaderBlocked = false;
					return;
				} else {
					oScrollExtension._bHScrollHsbBlocked = true;
					oScrollExtension._bHScrollContentBlocked = true;
				}
			} else if (oEvent.target.id === sContentScrollId) {
				if (oScrollExtension._bHScrollContentBlocked) {
					oScrollExtension._bHScrollContentBlocked = false;
					return;
				} else {
					oScrollExtension._bHScrollHsbBlocked = true;
					oScrollExtension._bHScrollHeaderBlocked = true;
				}
			}

			// Synchronize the scroll positions.
			var iScrollLeft = oEvent.target.scrollLeft;
			if (oEvent.target.id !== sHsbId) {
				document.getElementById(sHsbId).scrollLeft = iScrollLeft;
			}
			if (oEvent.target.id !== sHeaderScrollId) {
				document.getElementById(sHeaderScrollId).scrollLeft = iScrollLeft;
			}
			if (oEvent.target.id !== sContentScrollId) {
				document.getElementById(sContentScrollId).scrollLeft = iScrollLeft;
			}

			this._determineVisibleCols(this._collectTableSizes());
		},

		/**
		 * Will be called when scrolled vertically. Updates the visualized data by applying the first visible row from the vertical scrollbar.
		 * @param {UIEvent} oEvent The event object.
		 */
		onVerticalScrolling: function(oEvent) {
			var oScrollExtension = this._getScrollExtension();

			// For interaction detection.
			jQuery.sap.interaction.notifyScrollEvent && jQuery.sap.interaction.notifyScrollEvent(oEvent);

			if (oScrollExtension._bIsScrolledByKeyboard) {
				return;
			}

			// Do not scroll in action mode when scrolling was not initiated by a keyboard action! Might cause loss of user input and other undesired behavior.
			this._getKeyboardExtension().setActionMode(false);

			/**
			 * Adjusts the first visible row to the new horizontal scroll position.
			 * @param {sap.ui.table.Table} oTable Instance of the table.
			 */
			function updateVisibleRow(oTable) {
				var oVSb = oTable._getScrollExtension().getVerticalScrollbar();

				if (!oVSb) {
					return;
				}

				var iScrollTop = oVSb.scrollTop;

				if (TableUtils.isVariableRowHeightEnabled(oTable)) {
					oTable._iScrollTop = iScrollTop;
					oTable._adjustTablePosition(iScrollTop, oTable._aRowHeights);
				}

				oTable.setFirstVisibleRow(oTable._getFirstVisibleRowByScrollTop(iScrollTop), true);
			}

			if (this._bLargeDataScrolling && !oScrollExtension._bIsScrolledVerticallyByWheel) {
				jQuery.sap.clearDelayedCall(this._mTimeouts.scrollUpdateTimerId);
				this._mTimeouts.scrollUpdateTimerId = jQuery.sap.delayedCall(300, this, function() {
					updateVisibleRow(this);
					delete this._mTimeouts.scrollUpdateTimerId;
				});
			} else {
				updateVisibleRow(this);
			}

			oScrollExtension._bIsScrolledVerticallyByWheel = false;
		},

		/**
		 * Will be called when scrolled with the mouse wheel.
		 * @param {WheelEvent} oEvent The event object.
		 */
		onMouseWheelScrolling: function(oEvent) {
			var oScrollExtension = this._getScrollExtension();
			var oOriginalEvent = oEvent.originalEvent;
			var bHorizontalScrolling = oOriginalEvent.shiftKey;
			var bScrollingForward;
			var bScrolledToEnd = false;
			var iScrollDelta = 0;

			if (Device.browser.firefox) {
				iScrollDelta = oOriginalEvent.detail;
			} else if (bHorizontalScrolling) {
				iScrollDelta = oOriginalEvent.deltaX;
			} else {
				iScrollDelta = oOriginalEvent.deltaY;
			}

			bScrollingForward = iScrollDelta > 0;

			if (bHorizontalScrolling) {
				var oHSb = oScrollExtension.getHorizontalScrollbar();

				if (bScrollingForward) {
					bScrolledToEnd = oHSb.scrollLeft === oHSb.scrollWidth - oHSb.clientWidth;
				} else {
					bScrolledToEnd = oHSb.scrollLeft === 0;
				}

				if (oScrollExtension.isHorizontalScrollbarVisible() && !bScrolledToEnd) {
					oEvent.preventDefault();
					oEvent.stopPropagation();

					oHSb.scrollLeft = oHSb.scrollLeft + iScrollDelta;
				}

			} else {
				var oVSb = oScrollExtension.getVerticalScrollbar();

				if (bScrollingForward) {
					bScrolledToEnd = oVSb.scrollTop === oVSb.scrollHeight - oVSb.clientHeight;
				} else {
					bScrolledToEnd = oVSb.scrollTop === 0;
				}

				if (oScrollExtension.isVerticalScrollbarVisible() && !bScrolledToEnd) {
					oEvent.preventDefault();
					oEvent.stopPropagation();

					var iRowsPerStep = iScrollDelta / this._getDefaultRowHeight();

					// If at least one row is scrolled, floor to full rows.
					// Below one row, we scroll pixels.
					if (iRowsPerStep > 1) {
						iRowsPerStep = Math.floor(iRowsPerStep);
					}

					oScrollExtension._bIsScrolledVerticallyByWheel = true;
					oVSb.scrollTop += iRowsPerStep * this._getScrollingPixelsForRow();
				}
			}
		},

		/**
		 * Will be called when the vertical scrollbar is clicked.
		 * @param {MouseEvent} oEvent The event object.
		 */
		onVerticalScrollbarMouseDown: function(oEvent) {
			var oScrollExtension = this._getScrollExtension();
			oScrollExtension._bIsScrolledVerticallyByWheel = false;
			oScrollExtension._bIsScrolledByKeyboard = false;
		}
	};

	/*
	 * Event handling for scrolling.
	 * "this" in the function context is the table instance.
	 */
	var ExtensionDelegate = {
		ontouchstart: function(oEvent) {
			if (this._isTouchMode(oEvent)) {
				this._aTouchStartPosition = null;
				this._bIsScrollVertical = null;
				var $scrollTargets = this._getScrollTargets();
				var bDoScroll = jQuery(oEvent.target).closest($scrollTargets).length > 0;
				if (bDoScroll) {
					var oTouch = oEvent.targetTouches[0];
					this._aTouchStartPosition = [oTouch.pageX, oTouch.pageY];
					var oVsb = this._getScrollExtension().getVerticalScrollbar();
					if (oVsb) {
						this._iTouchScrollTop = oVsb.scrollTop;
					}

					var oHsb = this._getScrollExtension().getHorizontalScrollbar();
					if (oHsb) {
						this._iTouchScrollLeft = oHsb.scrollLeft;
					}
				}
			}
		},

		ontouchmove: function(oEvent) {
			if (this._isTouchMode(oEvent) && this._aTouchStartPosition) {
				var oTouch = oEvent.targetTouches[0];
				var iDeltaX = (oTouch.pageX - this._aTouchStartPosition[0]);
				var iDeltaY = (oTouch.pageY - this._aTouchStartPosition[1]);
				if (this._bIsScrollVertical == null) {
					this._bIsScrollVertical = Math.abs(iDeltaY) > Math.abs(iDeltaX);
				}

				if (this._bIsScrollVertical) {
					var oVsb = this._getScrollExtension().getVerticalScrollbar();
					if (oVsb) {
						var iScrollTop = this._iTouchScrollTop - iDeltaY;

						if (iScrollTop > 0 && iScrollTop < (this.getDomRef("vsb-content").clientHeight - oVsb.clientHeight) - 1) {
							oEvent.preventDefault();
							oEvent.stopPropagation();
						}
						oVsb.scrollTop = iScrollTop;
					}
				} else {
					var oHsb = this._getScrollExtension().getHorizontalScrollbar();
					if (oHsb) {
						var iScrollLeft = this._iTouchScrollLeft - iDeltaX;

						if (iScrollLeft > 0 && iScrollLeft < (this.getDomRef("hsb-content").clientWidth - oHsb.clientWidth) - 1) {
							oEvent.preventDefault();
							oEvent.stopPropagation();
						}
						oHsb.scrollLeft = iScrollLeft;
					}
				}
			}
		}
	};

	/**
	 * Extension for sap.ui.table.Table which handles scrolling.
	 *
	 * @class Extension for sap.ui.table.Table which handles scrolling.
	 *
	 * @extends sap.ui.table.TableExtension
	 * @author SAP SE
	 * @version ${version}
	 * @constructor
	 * @private
	 * @alias sap.ui.table.TableScrollExtension
	 */
	var TableScrollExtension = TableExtension.extend("sap.ui.table.TableScrollExtension", /* @lends sap.ui.table.TableScrollExtension */ {

		/*
		 * @see TableExtension._init
		 */
		_init: function(oTable, sTableType, mSettings) {
			this._type = sTableType;
			this._delegate = ExtensionDelegate;
			this._bIsScrolledVerticallyByWheel = false;
			this._bIsScrolledByKeyboard = false;

			// Register the delegate
			oTable.addEventDelegate(this._delegate, oTable);

			return "ScrollExtension";
		},

		/*
		 * @see TableExtension._attachEvents
		 */
		_attachEvents: function() {
			var oTable = this.getTable();
			var $Table = oTable.$();

			// Horizontal scrolling
			var $HSb = jQuery(this.getHorizontalScrollbar());
			var $HeaderScroll = jQuery(oTable.getDomRef("sapUiTableColHdrScr"));
			var $FixedHeaderScroll = $Table.find(".sapUiTableCtrlScrFixed.sapUiTableCHA");
			var $ContentScroll = jQuery(oTable.getDomRef("sapUiTableCtrlScr"));
			var $FixedContentScroll = jQuery(oTable.getDomRef(".sapUiTableCtrlScrFixed:not(.sapUiTableCHA)"));

			$HSb.on("scroll.sapUiTableHScroll", ExtensionHelper.onHorizontalScrolling.bind(oTable));
			$HeaderScroll.on("scroll", ExtensionHelper.onHorizontalScrolling.bind(oTable));
			$ContentScroll.on("scroll", ExtensionHelper.onHorizontalScrolling.bind(oTable));
			$FixedContentScroll.on("scroll", ExtensionHelper.onHorizontalScrolling.bind(oTable));
			$FixedHeaderScroll.on("scroll.sapUiTableFixedHeaderHScroll", ExtensionHelper.onFixedAreaHorizontalScrolling);
			$FixedContentScroll.on("scroll.sapUiTableFixedContentHScroll", ExtensionHelper.onFixedAreaHorizontalScrolling);

			// Vertical scrolling
			var $VSb = jQuery(this.getVerticalScrollbar());
			$VSb.on("scroll.sapUiTableVScroll", ExtensionHelper.onVerticalScrolling.bind(oTable));
			$VSb.on("mousedown.sapUiTableVScrollClick", ExtensionHelper.onVerticalScrollbarMouseDown.bind(oTable));

			// Mouse wheel
			if (Device.browser.firefox) {
				oTable._getScrollTargets().on("MozMousePixelScroll.sapUiTableMouseWheel", ExtensionHelper.onMouseWheelScrolling.bind(oTable));
			} else {
				oTable._getScrollTargets().on("wheel.sapUiTableMouseWheel", ExtensionHelper.onMouseWheelScrolling.bind(oTable));
			}
		},

		/*
		 * @see TableExtension._detachEvents
		 */
		_detachEvents: function() {
			var oTable = this.getTable();
			var $Table = oTable.$();

			// Horizontal scrolling
			var $HSb = jQuery(this.getHorizontalScrollbar());
			var $HeaderScroll = jQuery(oTable.getDomRef("sapUiTableColHdrScr"));
			var $FixedHeaderScroll = $Table.find(".sapUiTableColHdrFixed");
			var $ContentScroll = jQuery(oTable.getDomRef("sapUiTableCtrlScr"));
			var $FixedContentScroll = jQuery(oTable.getDomRef("sapUiTableCtrlScrFixed"));

			$HSb.off("scroll.sapUiTableHScroll");
			$HeaderScroll.off("scroll");
			$ContentScroll.off("scroll");
			$FixedContentScroll.off("scroll");
			$FixedHeaderScroll.off("scroll.sapUiTableFixedHeaderHScroll");
			$FixedContentScroll.off("scroll.sapUiTableFixedContentHScroll");

			// Vertical scrolling
			var $VSb = jQuery(this.getVerticalScrollbar());

			$VSb.off("scroll.sapUiTableVScroll");

			// Mouse wheel
			if (Device.browser.firefox) {
				oTable._getScrollTargets().off("MozMousePixelScroll.sapUiTableMouseWheel");
			} else {
				oTable._getScrollTargets().off("wheel.sapUiTableMouseWheel");
			}
		},

		/*
		 * Enables debugging for the extension.
		 */
		_debug: function() {
			this._ExtensionHelper = ExtensionHelper;
			this._ExtensionDelegate = ExtensionDelegate;
		},

		/*
		 * @see sap.ui.base.Object#destroy
		 */
		destroy: function() {
			// Deregister the delegates
			var oTable = this.getTable();
			if (oTable) {
				oTable.removeEventDelegate(this._delegate);
			}
			this._delegate = null;

			TableExtension.prototype.destroy.apply(this, arguments);
		},

		// "Public" functions which allow the table to communicate with this extension should go here.

		/**
		 * Scrolls the data in the table forward or backward by setting the property <code>firstVisibleRow</code>.
		 *
		 * @param {boolean} [bDown=false] Whether to scroll down or up.
		 * @param {boolean} [bPage=false] If <code>true</code>, the amount of visible scrollable rows (a page) is scrolled, otherwise a single row is scrolled.
		 * @param {boolean} [bIsKeyboardScroll=false] Indicates whether scrolling is initiated by a keyboard action.
		 * @return {boolean} Returns <code>true</code>, if scrolling was actually performed.
		 * @private
		 */
		scroll: function(bDown, bPage, bIsKeyboardScroll) {
			if (bDown == null) {
				bDown = false;
			}
			if (bPage == null) {
				bPage = false;
			}
			if (bIsKeyboardScroll == null) {
				bIsKeyboardScroll = false;
			}

			var oTable = this.getTable();
			var bScrolled = false;
			var iRowCount = oTable._getRowCount();
			var iVisibleRowCount = oTable.getVisibleRowCount();
			var iScrollableRowCount = iVisibleRowCount - oTable.getFixedRowCount() - oTable.getFixedBottomRowCount();
			var iFirstVisibleScrollableRow = oTable._getSanitizedFirstVisibleRow();
			var iSize = bPage ? iScrollableRowCount : 1;

			if (bDown) {
				if (iFirstVisibleScrollableRow + iVisibleRowCount < iRowCount) {
					oTable.setFirstVisibleRow(Math.min(iFirstVisibleScrollableRow + iSize, iRowCount - iVisibleRowCount));
					bScrolled = true;
				}
			} else if (iFirstVisibleScrollableRow > 0) {
				oTable.setFirstVisibleRow(Math.max(iFirstVisibleScrollableRow - iSize, 0));
				bScrolled = true;
			}

			if (bScrolled && bIsKeyboardScroll) {
				this._bIsScrolledByKeyboard = true;
			}

			return bScrolled;
		},

		/**
		 * Scrolls the data in the table to the end or to the beginning by setting the property <code>firstVisibleRow</code>.
		 *
		 * @param {boolean} [bDown=false] Whether to scroll down or up.
		 * @param {boolean} [bIsKeyboardScroll=false] Indicates whether scrolling is initiated by a keyboard action.
		 * @returns {boolean} Returns <code>true</code>, if scrolling was actually performed.
		 * @private
		 */
		scrollMax: function(bDown, bIsKeyboardScroll) {
			if (bDown == null) {
				bDown = false;
			}
			if (bIsKeyboardScroll == null) {
				bIsKeyboardScroll = false;
			}

			var oTable = this.getTable();
			var bScrolled = false;
			var iFirstVisibleScrollableRow = oTable._getSanitizedFirstVisibleRow();

			if (bDown) {
				var iFirstVisibleRow = oTable._getRowCount() - TableUtils.getNonEmptyVisibleRowCount(oTable);
				if (iFirstVisibleScrollableRow < iFirstVisibleRow) {
					oTable.setFirstVisibleRow(iFirstVisibleRow);
					bScrolled = true;
				}
			} else if (iFirstVisibleScrollableRow > 0) {
				oTable.setFirstVisibleRow(0);
				bScrolled = true;
			}

			if (bScrolled && bIsKeyboardScroll) {
				this._bIsScrolledByKeyboard = true;
			}

			return bScrolled;
		},

		/**
		 * Returns the horizontal scrollbar.
		 *
		 * @returns {HTMLElement|null} Returns <code>null</code>, if the horizontal scrollbar does not exist.
		 * @private
		 */
		getHorizontalScrollbar: function() {
			var oTable = this.getTable();

			if (oTable != null) {
				var oVSb = oTable.getDomRef(SharedDomRef.HorizontalScrollBar);

				if (oVSb != null) {
					return oVSb;
				}
			}

			return null;
		},

		/**
		 * Returns the vertical scrollbar.
		 *
		 * @returns {HTMLElement|null} Returns <code>null</code>, if the vertical scrollbar does not exist.
		 * @private
		 */
		getVerticalScrollbar: function() {
			var oTable = this.getTable();

			if (oTable != null) {
				var oVSb = oTable.getDomRef(SharedDomRef.VerticalScrollBar);

				if (oVSb != null) {
					return oVSb;
				}
			}

			return null;
		},

		isHorizontalScrollbarVisible: function() {
			var oTable = this.getTable();

			if (oTable != null) {
				var oTableElement = oTable.getDomRef();

				if (oTableElement != null) {
					return oTableElement.classList.contains("sapUiTableHScr");
				}
			}

			return false;
		},

		isVerticalScrollbarVisible: function() {
			var oTable = this.getTable();

			if (oTable != null) {
				var oTableElement = oTable.getDomRef();

				if (oTableElement != null) {
					return oTableElement.classList.contains("sapUiTableVScr");
				}
			}

			return false;
		},

		updateVSbMaxHeight: function() {
			var oTable = this.getTable();
			oTable.getDomRef(SharedDomRef.VerticalScrollBar).style.maxHeight = oTable._getVSbHeight() + "px";
		}
	});

	return TableScrollExtension;

}, /* bExport= */ true);