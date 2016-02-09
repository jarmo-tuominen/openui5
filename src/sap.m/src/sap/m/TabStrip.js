/*!
 * ${copyright}
 */

sap.ui.define(['jquery.sap.global', 'sap/ui/core/Control', 'sap/ui/core/IconPool', 'sap/ui/core/delegate/ItemNavigation',
	'sap/ui/base/ManagedObject', 'sap/ui/core/delegate/ScrollEnablement', 'sap/ui/core/InvisibleText', './AccButton', './TabStripItem', './TabStripSelect', 'sap/ui/Device'],
	function(jQuery, Control, IconPool, ItemNavigation, ManagedObject, ScrollEnablement, InvisibleText, AccButton, TabStripItem, TabStripSelect, Device) {
		"use strict";

		/**
		 * Constructor for a new <code>TabStrip</code>.
		 *
		 * @param {string} [sID] ID for the new control, generated automatically if no ID is given
		 * @param {object} [mSettings] Initial settings for the new control
		 *
		 * @class
		 * This control displays a number of tabs. If the available horizontal
		 * space is exceeded, a horizontal scrollbar appears.
		 *
		 * @extends sap.ui.core.Control
		 * @version ${version}
		 *
		 * @constructor
		 * @private
		 * @since 1.34
		 * @alias sap.m.TabStrip
		 */
		var TabStrip = Control.extend("sap.m.TabStrip", /** @lends sap.m.TabStrip.prototype */ {
			metadata : {
				library : "sap.m",
				properties : {

					/**
					 * Defines whether the button <code>Opened Tabs</code> for showing all the tabs in a dropdown menu is present.
					 */
					hasSelect : {type : "boolean", group : "Misc", defaultValue : false}
				},
				aggregations : {

					/**
					 * The tabs displayed in the <code>TabStrip</code>.
					 */
					items : {type : "sap.m.TabStripItem", multiple : true, singularName : "item"},

					/**
					 * The <code>Opened Tabs</code> button displayed in the <code>TabStrip</code>.
					 * ToDo: check if this has to be removed
					 */
					downArrowButton : {type : "sap.m.Button", multiple : false, singularName : "downArrowButton"},

					/**
					 * The <code>Add New Tab</code> button displayed in the <code>TabStrip</code>.
					 */
					addButton : {type : "sap.m.Button", multiple : false, singularName : "addButton"},

					/**
					 * Holds the instance of the select when <code>hasSelect</code> is set to <code>true</code>.
					 */
					_select : {type: 'sap.m.TabStripSelect', multiple : false, visibility : "hidden"}
				},
				associations: {

					/**
					 * Sets or retrieves the selected item from the <code>items</code> aggregation..
					 */
					selectedItem: {type : 'sap.m.TabStripItem', group : "Misc"}
				},
				events : {

					/**
					 * Fired when an item is selected.
					 */
					selectionChange: {
						parameters: {

							/**
							 * The selected item.
							 */
							item: {type: "sap.m.TabStripItem"}
						}
					},

					/**
					 * Fired when an item is closed.
					 */
					itemCloseRequest: {
						allowPreventDefault: true,
						parameters: {

							/**
							 * The closed item.
							 */
							item: {type: "sap.m.TabStripItem"}
						}
					},

					/**
					 * Fired when an item is pressed.
					 * ToDo: check if this has to be removed
					 */
					itemPress: {
						parameters: {

							/**
							 * The pressed item.
							 */
							item: { type: "sap.m.TabStripItem" }
						}
					}
				}
			},
			constructor : function (vId, mSettings) {
				var bHasSelect = false;
				// normalize the expected arguments
				if (!mSettings && typeof vId === 'object') {
					mSettings = vId;
				}

				/* Stash the 'hasSelect' setting for later in order to have all items added to the tabstrip
				* before the "select" control is instantiated. */
				if (mSettings) {
					bHasSelect = mSettings['hasSelect'];
					delete mSettings['hasSelect'];
				}

				sap.ui.base.ManagedObject.prototype.constructor.apply(this, arguments);

				// after the tabstrip is instantiated, add the select
				this.setProperty('hasSelect', bHasSelect, true);
			}
		});

		/**
		 * Library internationalization resource bundle.
		 *
		 * @type {jQuery.sap.util.ResourceBundle}
		 */
		var oRb = sap.ui.getCore().getLibraryResourceBundle("sap.m");

		/**
		 * Icon buttons used in <code>TabStrip</code>.
		 *
		 * @enum
		 * @type {{LeftArrowButton: string, RightArrowButton: string, DownArrowButton: string, AddButton: string}}
		 * @private
		 */
		TabStrip._ICONBUTTONS = {
			LeftArrowButton     : "slim-arrow-left",
			RightArrowButton    : "slim-arrow-right",
			DownArrowButton     : "slim-arrow-down",
			AddButton           : "add",
			DeclineButton       : "decline"
		};

		/**
		 * <code>TabStripSelect</code> ID prefix.
		 *
		 * @type {string}
		 * @public
		 */
		TabStrip.SELECT_ITEMS_ID_PREFIX = 'SelectItem-';

		/**
		 * ScrollLeft constant.
		 *
		 * @type {number}
		 * @private
		 */
		TabStrip._SCROLLSIZE = 320;

		/**
		 * The minimum horizontal offset threshold for drag/swipe.
		 * @type {number}
		 * @private
		 */
		TabStrip._MINDRAGOFFSET = sap.ui.Device.support.touch ? 15 : 5;

		/**
		 * Scrolling animation duration constant
		 *
		 * @type {number}
		 * @private
		 */
		TabStrip._SCROLL_ANIMATION_DURATION = sap.ui.getCore().getConfiguration().getAnimation() ? 500 : 0;

		/**
		 * Initializes the control.
		 *
		 * @override
		 * @public
		 */
		TabStrip.prototype.init = function () {
			this._bDoScroll = !sap.ui.Device.system.phone;
			this._bRtl = sap.ui.getCore().getConfiguration().getRTL();
			this._iCurrentScrollLeft = 0;
			this._iMaxOffsetLeft = null;
			this._scrollable = null;
			this._oLeftArrowButton = null;
			this._oRightArrowButton = null;
			this._oTouchStartX = null;

			if (!sap.ui.Device.system.phone) {
				this._oScroller = new ScrollEnablement(this, this.getId() + "-tabs", {
					horizontal: true,
					vertical: false,
					nonTouchScrolling: true
				});
			}
		};

		/**
		 * Called from parent if the control is destroyed.
		 *
		 * @override
		 * @public
		 */
		TabStrip.prototype.exit = function () {
			this._bRtl = null;
			this._iCurrentScrollLeft = null;
			this._iMaxOffsetLeft = null;
			this._scrollable = null;
			this._oTouchStartX = null;
			if (this._oLeftArrowButton) {
				this._oLeftArrowButton.destroy();
				this._oLeftArrowButton = null;
			}
			if (this._oRightArrowButton) {
				this._oRightArrowButton.destroy();
				this._oRightArrowButton = null;
			}
			if (this._oScroller) {
				this._oScroller.destroy();
				this._oScroller = null;
			}
			if (this._sResizeListenerId) {
				sap.ui.core.ResizeHandler.deregister(this._sResizeListenerId);
				this._sResizeListenerId = null;
			}
			this._removeItemNavigation();
		};

		/**
		 * Called before the rendering of the control is started.
		 *
		 * @override
		 * @public
		 */
		TabStrip.prototype.onBeforeRendering = function () {
			var oDownArrowButton = this.getDownArrowButton(),
			    oAddButton = this.getAddButton();

			if (this._sResizeListenerId) {
				sap.ui.core.ResizeHandler.deregister(this._sResizeListenerId);
				this._sResizeListenerId = null;
			}

			//Create overflow buttons
			this._oLeftArrowButton = this._generateButton(TabStrip._ICONBUTTONS.LeftArrowButton);
			this._oRightArrowButton = this._generateButton(TabStrip._ICONBUTTONS.RightArrowButton);
			//Override icons of down & add buttons if needed
			if (oDownArrowButton && oDownArrowButton.getIcon() != TabStrip._ICONBUTTONS.DownArrowButton) {
				oDownArrowButton.setIcon(IconPool.getIconURI(TabStrip._ICONBUTTONS.DownArrowButton));
			}
			if (oAddButton && oAddButton.getIcon() != TabStrip._ICONBUTTONS.AddButton) {
				oAddButton.setIcon(IconPool.getIconURI(TabStrip._ICONBUTTONS.AddButton));
			}
		};

		/**
		 * Called when the rendering of the control is completed.
		 *
		 * @override
		 * @public
		 */
		TabStrip.prototype.onAfterRendering = function () {
			//use ItemNavigation for keyboardHandling
			var aItems = this.getItems(),
			    aTabDomRefs = [];

			if (this._oScroller) {
				this._oScroller.setIconTabBar(this, jQuery.proxy(this._checkOverflow, this), null);
			}

			aItems.forEach(function(oTab) {
				var oItemDomRef = oTab.getDomRef();
				jQuery(oItemDomRef).attr("tabindex", "-1");
				aTabDomRefs.push(oItemDomRef);
			});

			this._addItemNavigation(this.getDomRef("tabContainer"), aTabDomRefs);

			this._adjustScrolling();

			this._sResizeListenerId = sap.ui.core.ResizeHandler.register(this.getDomRef(),  jQuery.proxy(this._adjustScrolling, this));
		};

		/**
		 * Finds the DOM element that should get the focus.
		 *
		 * @returns {null | Element} The element that have to receive the focus or null
		 * @public
		 * @override
		 */
		TabStrip.prototype.getFocusDomRef = function () {
			var oTab = sap.ui.getCore().byId(this.getSelectedItem());

			if (!oTab) {
				return null;
			}

			return oTab.getDomRef();
		};

		/**
		 * Returns an object representing the serialized focus information.
		 *
		 * @param oFocusInfo
		 * @override
		 * @public
		 */
		TabStrip.prototype.applyFocusInfo = function (oFocusInfo) {
			if (oFocusInfo.focusDomRef) {
				jQuery(oFocusInfo.focusDomRef).focus();
			}
		};

		/**
		 * Adds item navigation functionality.
		 *
		 * @param oHeadDomRef { Element } The parent DOM element holding the item DOM elements that have to be iterated
		 * @param aTabDomRefs { array<{Element}> } An array with all the DOM elements that have to be iterated
		 * @private
		 */
		TabStrip.prototype._addItemNavigation = function (oHeadDomRef, aTabDomRefs) {
			//Initialize the ItemNavigation
			if (!this._oItemNavigation) {
				this._oItemNavigation = new ItemNavigation();
			}
			//Setup the ItemNavigation
			this._oItemNavigation.setRootDomRef(oHeadDomRef);
			this._oItemNavigation.setItemDomRefs(aTabDomRefs);
			this._oItemNavigation.setCycling(false);
			this._oItemNavigation.setPageSize(5);

			//Attach ItemNavigation to the control delegate queue
			this.addDelegate(this._oItemNavigation);
		};

		/**
		 * Checks if scrolling is needed.
		 *
		 * @returns {boolean} Whether scrolling is needed
		 * @private
		 */
		TabStrip.prototype._checkScrolling = function() {
			var oTabsDomRef = this.getDomRef("tabs"),
				bScrollNeeded = oTabsDomRef && (oTabsDomRef.scrollWidth > this.getDomRef("tabContainer").clientWidth);

			this.$().toggleClass("sapMTSScrollable", bScrollNeeded);

			return bScrollNeeded;
		};

		TabStrip.prototype._checkOverflow = function() {
			var oTabsDomRef = this.getDomRef("tabs"),
				oTabContainerDomRef = this.getDomRef("tabContainer"),
				iScrollLeft,
				realWidth,
				availableWidth,
				bScrollBack = false,
				bScrollForward = false;

			if (this._checkScrolling() && oTabsDomRef && oTabContainerDomRef) {
				if (this._bRtl && Device.browser.firefox) {
					iScrollLeft = -oTabContainerDomRef.scrollLeft;
				} else {
					iScrollLeft = oTabContainerDomRef.scrollLeft;
				}

				realWidth = oTabsDomRef.scrollWidth;
				availableWidth = oTabContainerDomRef.clientWidth;
				if (Math.abs(realWidth - availableWidth) === 1) {
					realWidth = availableWidth;
				}

				if (iScrollLeft > 0) {
					bScrollBack = true;
				}
				if ((realWidth > availableWidth) && (iScrollLeft + availableWidth < realWidth)) {
					bScrollForward = true;
				}

				this.$().toggleClass("sapMTSScrollBack", bScrollBack)
						.toggleClass("sapMTSScrollForward", bScrollForward);
			} else {
				this.$().toggleClass("sapMTSScrollBack", false)
						.toggleClass("sapMTSScrollForward", false);
			}
		};

		TabStrip.prototype._adjustScrolling = function() {

			this._iMaxOffsetLeft = Math.abs(this.$("tabContainer").width() - this.$("tabs").width());

			this._checkOverflow();
		};

		/**
		 * Generates an IconOnly transparent button.
		 *
		 * @param oButtonType { TabStrip._ICONBUTTONS }
		 * @returns { sap.m.Button } The generated button
		 * @private
		 */
		TabStrip.prototype._generateButton = function (oButtonType) {
			var that = this,
			    oButton;

			switch (oButtonType) {
				case TabStrip._ICONBUTTONS.LeftArrowButton:
					oButton = new AccButton({
						type: sap.m.ButtonType.Transparent,
						icon: IconPool.getIconURI(oButtonType),
						tooltip: oRb.getText("TABSTRIP_SCROLL_BACK"),
						tabIndex: "-1",
						ariaHidden: "true",
						press: function (oEvent) {
							that._scroll(-TabStrip._SCROLLSIZE, TabStrip._SCROLL_ANIMATION_DURATION);
						}
					});
					break;
				case TabStrip._ICONBUTTONS.RightArrowButton:
					oButton = new AccButton({
						type: sap.m.ButtonType.Transparent,
						icon: IconPool.getIconURI(oButtonType),
						tooltip: oRb.getText("TABSTRIP_SCROLL_FORWARD"),
						tabIndex: "-1",
						ariaHidden: "true",
						press: function (oEvent) {
							that._scroll(TabStrip._SCROLLSIZE, TabStrip._SCROLL_ANIMATION_DURATION);
						}
					});
					break;
				case TabStrip._ICONBUTTONS.DownArrowButton:
					oButton = new AccButton({
						type: sap.m.ButtonType.Transparent,
						icon: IconPool.getIconURI(oButtonType)
					});
					break;
				case TabStrip._ICONBUTTONS.AddButton:
					oButton = new sap.m.Button({
						type: sap.m.ButtonType.Transparent,
						icon: IconPool.getIconURI(oButtonType)
					});
					break;
				case TabStrip._ICONBUTTONS.DeclineButton:
					oButton = new sap.m.Button({
						type: sap.m.ButtonType.Transparent,
						icon: oButtonType
					});
					break;
				default:
					break;
			}
			return oButton;
		};

		/**
		 * Removes the item navigation delegate.
		 *
		 * @private
		 */
		TabStrip.prototype._removeItemNavigation = function () {
			if (this._oItemNavigation) {
				this.removeDelegate(this._oItemNavigation);
				this._oItemNavigation.destroy();
				delete this._oItemNavigation;
			}
		};

		/**
		 * Performs horizontal scroll.
		 *
		 * @param iDelta {int} The target scrollLeft value
		 * @param iDuration {int} Scroll animation duration
		 * @private
		 */
		TabStrip.prototype._scroll = function(iDelta, iDuration) {
			var iScrollLeft = this.getDomRef("tabContainer").scrollLeft,
				iScrollTarget;

			if (this._bRtl && Device.browser.firefox) {
				iScrollTarget = iScrollLeft - iDelta;

				// Avoid out ofRange situation
				if (iScrollTarget < -this._iMaxOffsetLeft) {
					iScrollTarget = -this._iMaxOffsetLeft;
				}
				if (iScrollTarget > 0) {
					iScrollTarget = 0;
				}
			} else {
				iScrollTarget = iScrollLeft + iDelta;

				if (iScrollTarget < 0) {
					iScrollTarget = 0;
				}
				if (iScrollTarget > this._iMaxOffsetLeft) {
					iScrollTarget = this._iMaxOffsetLeft;
				}
			}

			this._oScroller.scrollTo(iScrollTarget, 0, iDuration);
			this._iCurrentScrollLeft = iScrollTarget;
		};

		/**
		 * Scrolls to a particular item.
		 *
		 * @param oItem {sap.m.TabStripItem} The item to be scrolled to
		 * @param iDuration {int} Duration of the scrolling animation
		 * @private
		 */
		TabStrip.prototype._scrollIntoView = function (oItem, iDuration) {
			var $tabs = this.$("tabs"),
				$item = oItem.$(),
				iTabsPaddingWidth = $tabs.innerWidth() - $tabs.width(),
				iItemWidth = $item.outerWidth(true),
				iItemPosLeft = $item.position().left - iTabsPaddingWidth / 2,
				oTabContainerDomRef = this.getDomRef("tabContainer"),
				iScrollLeft = oTabContainerDomRef.scrollLeft,
				iContainerWidth = this.$("tabContainer").width(),
				iNewScrollLeft = iScrollLeft;

			// check if item is outside of viewport
			if (iItemPosLeft < 0 || iItemPosLeft > iContainerWidth - iItemWidth) {

				if (this._bRtl && Device.browser.firefox) {
					if (iItemPosLeft < 0) { // right side: make this the last item
						iNewScrollLeft += iItemPosLeft + iItemWidth - iContainerWidth;
					} else { // left side: make this the first item
						iNewScrollLeft += iItemPosLeft;
					}
				} else {
					if (iItemPosLeft < 0) { // left side: make this the first item
						iNewScrollLeft += iItemPosLeft;
					} else { // right side: make this the last item
						iNewScrollLeft += iItemPosLeft + iItemWidth - iContainerWidth;
					}
				}

				// store current scroll state to set it after rerendering
				this._iCurrentScrollLeft = iNewScrollLeft;
				this._oScroller.scrollTo(iNewScrollLeft, 0, iDuration);

			}
		};


		/**
		 * Create the instance of the <code>TabStripSelect</code>.
		 *
		 * @param aTabStripItems { array<sap.m.TabStripItem> } Array with the <code>TabStripItems</code>
		 * @returns {sap.m.TabStripSelect} The created <code>TabStripSelect</code>
		 * @private
		 */
		TabStrip.prototype._createSelect = function (aTabStripItems) {
			var oSelect,
				oSelectedSelectItem,
				oSelectedTabStripItem,
				oConstructorSettings = {
					type: sap.m.SelectType.IconOnly,
					autoAdjustWidth : true,
					icon: sap.ui.core.IconPool.getIconURI("slim-arrow-down"),
					tooltip: oRb.getText("TABSTRIP_OPENED_TABS"),
					change: function (oEvent) {
						oSelectedSelectItem = oEvent.getParameters()['selectedItem'];
						oSelectedTabStripItem = oAggregationsHelper.findTabStripItemFromSelectItem.call(this,oSelectedSelectItem);
						this._activateItem(oSelectedTabStripItem);
					}.bind(this)
				};

			oSelect = new TabStripSelect(oConstructorSettings);

			oAggregationsHelper.addItemsToSelect.call(this, oSelect, aTabStripItems);

			return oSelect;
		};


		/**
		 * Handles when the Space or Enter key is pressed.
		 *
		 * @param {jQuery.Event} oEvent The event object
		 */
		TabStrip.prototype.onsapselect = function(oEvent) {
			// mark the event for components that needs to know if the event was handled
			oEvent.setMarked();
			// note: prevent document scrolling when space keys is pressed
			oEvent.preventDefault();
			this._activateItem(oEvent.srcControl);
		};

		/**
		 * Handles the delete keyboard event.
		 * @param oEvent
		 */
		TabStrip.prototype.onsapdelete = function(oEvent) {
			var oItem = jQuery("#" + oEvent.target.id).control(0),
				bShouldChangeSelection = oItem.getId() === this.getSelectedItem(),
				fnSelectionCallback = function() {
					this._moveToNextItem(bShouldChangeSelection);
				};

				this._removeItem(oItem, fnSelectionCallback);
		};

		/**
		 * Calculates the next item to be focused and selected and applies the focus and selection when an item is removed.
		 *
		 * @param bSetAsSelected {boolean} Whether the next item to be selected
		 * @private
		 */
		TabStrip.prototype._moveToNextItem = function (bSetAsSelected) {
			var iItemsCount = this.getItems().length,
				iCurrentFocusedIndex = this._oItemNavigation.getFocusedIndex(),
				iNextIndex = iItemsCount === iCurrentFocusedIndex ? --iCurrentFocusedIndex : iCurrentFocusedIndex,
				oNextItem = this.getItems()[iNextIndex],
				fnFocusCallback = function () {
					this._oItemNavigation.focusItem(iNextIndex);
				};


				//ToDo: Might be reconsidered when TabStrip is released for standalone usage
				// Selection (causes invalidation)
				if (bSetAsSelected) {
					this.setSelectedItem(oNextItem);
					//Notify the subscriber
					this.fireSelectionChange({item: oNextItem});
				}
				// Focus (force to wait until invalidated)
				jQuery.sap.delayedCall(0, this, fnFocusCallback);
		};

		/**
		 * Activates an item on the <code>TabStrip</code>.
		 *
		 * @param oItem {sap.m.TabStripItem} The item to be activated
		 * @private
		 */
		TabStrip.prototype._activateItem = function(oItem) {
			if (oItem && oItem instanceof sap.m.TabStripItem) {
				this.fireItemPress({
					item: oItem
				});
				if (!this.getSelectedItem() || this.getSelectedItem() !== oItem.getId()) {
					this.setSelectedItem(oItem);
					this.fireSelectionChange({
						item: oItem
					});
				}
			}
		};

		/**
		 * Adds an entity <code>oObject</code> to the aggregation identified by <code>sAggregationName</code>.
		 *
		 * @param sAggregationName {string} The name of the aggregation where the new entity is to be added
		 * @param oObject {mixed} The value of the aggregation to be added
		 * @param bSuppressInvalidate {boolean} Whether to suppress invalidation
		 * @returns {sap.m.TabStrip} <code>this</code> pointer for chaining
		 * @override
		 */
		TabStrip.prototype.addAggregation = function(sAggregationName, oObject, bSuppressInvalidate) {
			if (sAggregationName === 'items') {
				oAggregationsHelper.handleItemsAggregation.call(this, ['addAggregation', oObject, bSuppressInvalidate], true);
			}
			return Control.prototype.addAggregation.call(this, sAggregationName, oObject, bSuppressInvalidate);
		};

		/**
		 * Inserts an entity to the aggregation named <code>sAggregationName</code> at position <code>iIndex</code>.
		 *
		 * @param sAggregationName {string} The name of the aggregation
		 * @param oObject {mixed} The value of the aggregation to be inserted
		 * @param bSuppressInvalidate {boolean} Whether to suppress invalidation
		 * @returns {sap.m.TabStrip} <code>this</code> pointer for chaining
		 * @override
		 */
		TabStrip.prototype.insertAggregation = function(sAggregationName, oObject, iIndex, bSuppressInvalidate) {
			if (sAggregationName === 'items') {
				oAggregationsHelper.handleItemsAggregation.call(this, ['insertAggregation', oObject, iIndex, bSuppressInvalidate], true);
			}
			return Control.prototype.insertAggregation.call(this, sAggregationName, oObject, iIndex, bSuppressInvalidate);
		};

		/**
		 * Removes an entity from the aggregation named <code>sAggregationName</code>.
		 *
		 * @param sAggregationName {string} The name of the aggregation
		 * @param oObject {mixed} The value of aggregation to be removed
		 * @param bSuppressInvalidate {boolean} Whether to suppress invalidation
		 * @returns {sap.m.TabStrip} <code>this</code> pointer for chaining
		 * @override
		 */
		TabStrip.prototype.removeAggregation = function(sAggregationName, oObject, bSuppressInvalidate) {
			if (sAggregationName === 'items') {
				oAggregationsHelper.handleItemsAggregation.call(this, ['removeAggregation', oObject, bSuppressInvalidate]);
			}
			return Control.prototype.removeAggregation.call(this, sAggregationName, oObject, bSuppressInvalidate);
		};

		/**
		 * Removes all objects from the aggregation named <code>sAggregationName</code>.
		 *
		 * @param sAggregationName {string} The name of aggregation
		 * @param bSuppressInvalidate {boolean} Whether to suppress invalidation
		 * @returns {sap.m.TabStrip} <code>this</code> pointer for chaining
		 * @override
		 */
		TabStrip.prototype.removeAllAggregation = function(sAggregationName, bSuppressInvalidate) {
			if (sAggregationName === 'items') {
				oAggregationsHelper.handleItemsAggregation.call(this, ['removeAllAggregation', null, bSuppressInvalidate]);
			}
			return Control.prototype.removeAllAggregation.call(this, sAggregationName, bSuppressInvalidate);
		};

		/**
		 * Destroys all the entities in the aggregation named <code>sAggregationName</code>.
		 *
		 * @param sAggregationName {string} The name of aggregation
		 * @param bSuppressInvalidate {boolean} Whether to suppress invalidation
		 * @returns {sap.m.TabStrip} <code>this</code> pointer for chaining
		 * @override
		 */
		TabStrip.prototype.destroyAggregation = function(sAggregationName, bSuppressInvalidate) {
			if (sAggregationName === 'items') {
				oAggregationsHelper.handleItemsAggregation.call(this, ['destroyAggregation', bSuppressInvalidate]);
			}
			return Control.prototype.destroyAggregation.call(this, sAggregationName, bSuppressInvalidate);
		};

		/**
		 * Sets a <code>TabStripItem</code> as current.
		 *
		 * @param {sap.m.TabStripItem} oSelectedItem the item that should be set as current
		 * @returns {sap.m.TabStrip} <code>this</code> pointer for chaining
		 * @override
		 */
		TabStrip.prototype.setSelectedItem = function(oSelectedItem) {
			if (!oSelectedItem) {
				return;
			}

			if (oSelectedItem.$().length > 0) {
				this._scrollIntoView(oSelectedItem, 500);
			}

			updateAriaSelectedAttributes(this.getItems(), oSelectedItem);
			updateSelectedItemClasses.call(this, oSelectedItem.getId());

			// propagate the selection change to the select aggregation
			if (this.getHasSelect()) {
				var oSelectItem = oAggregationsHelper.findSelectItemFromTabStripItem.call(this, oSelectedItem);
				this.getAggregation('_select').setSelectedItem(oSelectItem);
			}

			return TabStrip.prototype.setAssociation.call(this, "selectedItem", oSelectedItem, true); //render manually;
		};

		/**
		 * Overrides the default method to make sure a <code>TabStripSelect</code> instance is created when needed.
		 *
		 * @param sPropertyName {string} The property name to be set
		 * @param vValue {mixed} The property value to be set
		 * @param bSuppressInvalidate {boolean} Whether to suppress invalidation
		 * @returns {sap.m.TabStrip} <code>this</code> pointer for chaining
		 * @override
		 */
		TabStrip.prototype.setProperty = function(sPropertyName, vValue, bSuppressInvalidate) {
			var vRes;
			vRes = Control.prototype.setProperty.call(this, sPropertyName, vValue, bSuppressInvalidate);

			// handle the _select aggregation instance
			if (sPropertyName === 'hasSelect') {
				if (vValue) {
					if (!this.getAggregation('_select')) {
						vRes = this.setAggregation('_select', this._createSelect(this.getItems()));
					}
				} else {
					vRes = this.destroyAggregation('_select');
				}
			}

			return vRes;
		};


		/**
		 * oEventsHelper {object} EventHandling helper class
		 * ToDo: [Refactoring] Consider removing this helper class and adding its methods in TabStrip.prototype
		 * @private
		 */
		var oEventsHelper = {
			/**
			 * Attaches any previously added event handlers.
			 *
			 * @param oObject {object} The <code>TabStripItem</code> instance on which events will be detached/attached
			 * @private
			 */
			attachItemEventListeners: function (oObject) {
				// make sure we always have one listener at a time only
				oObject.detachItemClosePressed(oEventsHelper.handleItemClosePressed.bind(this));
				oObject.detachItemPropertyChanged(oEventsHelper.handleTabStripItemPropertyChanged.bind(this));

				oObject.attachItemPropertyChanged(oEventsHelper.handleTabStripItemPropertyChanged.bind(this));
				oObject.attachItemClosePressed(oEventsHelper.handleItemClosePressed.bind(this));
			},
			/**
			 * Detaches any previously added event handlers.
			 *
			 * @param oObject {object} The <code>TabStripItem</code> instance on which events will be detached/attached.
			 * @private
			 */
			detachItemEventListeners: function (oObject) {
				// !oObject check is needed because "null" is an object
				if (!oObject || typeof oObject !== 'object' || !oObject.getMetadata || oObject.getMetadata().getName() !== 'sap.m.TabStripItem') {
					// in case of no concrete item object, remove the listeners from all items
					// ToDo: confirm that the listeners removal is needed ..?
					var aItems = this.getItems();
					aItems.forEach(function (oItem) {
						if (typeof oItem !== 'object' || !oItem.getMetadata || oItem.getMetadata().getName() !== 'sap.m.TabStripItem') {
							// because of recursion, make sure it never goes into endless loop
							return;
						}
						return oEventsHelper.detachItemEventListeners.call(this, oItem);
					}.bind(this));
				}
			},
			/**
			 * Propagates the property change from a <code>TabStrip</code> item instance to the <code>TabStrip</code> select item copy instance.
			 *
			 * @param oEvent {jQuery.Event} Event object
			 * @private
			 */
			handleTabStripItemPropertyChanged: function (oEvent) {
				var oSelectItem = oAggregationsHelper.findSelectItemFromTabStripItem.call(this, oEvent.getSource());
				oSelectItem.setProperty(oEvent['mParameters'].propertyKey, oEvent['mParameters'].propertyValue);
			},
			/**
			 * Fires an item close request event based on an item close button press.
			 *
			 * @param oEvent {jQuery.Event} Event object
			 * @private
			 */
			handleItemClosePressed: function (oEvent) {
				this._removeItem(oEvent.getSource());
			}
		};


		/**
		 * Request the given item to be closed and removes it from the <code>items</code> aggregation if permitted.
		 *
		 * @param oItem {sap.m.TabStripItem} The item which will disappear
		 * @param fnCallback {function} A callback function to be called after the item is removed
		 * @private
		 */
		TabStrip.prototype._removeItem = function(oItem, fnCallback) {
			var oTabStripItem;
			/* this method is handling the close pressed event on all item instances (TabStrip and the
			 * TabStripSelect copy), so when it's handling the press on the TabStripSelect item, it needs to determine the TabStrip item out of the event and vice-versa */
			if (oItem.getMetadata().getName() !== 'sap.m.TabStripItem') {
				jQuery.sap.log.error('Expecting instance of a TabStripSelectItem, given: ', oItem);
			}
			if (oItem.getId().indexOf(TabStrip.SELECT_ITEMS_ID_PREFIX) !== -1) {
				oTabStripItem = oAggregationsHelper.findTabStripItemFromSelectItem.call(this, oItem);

			} else {
				oTabStripItem = oItem;
			}

			if (this.fireItemCloseRequest({item: oTabStripItem})) {
				this.removeAggregation('items', oTabStripItem); // the select item will also get removed
				this._moveToNextItem(oItem.getId() === this.getSelectedItem());

				if (fnCallback) {
					fnCallback.call(this);
				}
			}
		};

		/**
		 * oAggregationHelper {object} AggregationHandling helper class
		 * ToDo: [Refactoring] Consider removing this helper class and adding its methods in TabStrip.prototype
		 * @private
		 */
		var oAggregationsHelper = {
			/**
			 * Ensures proper handling of <code>TabStrip</code> <code>items</code> aggregation> and proxies to the <code>TabStripSelect</code> <code>items</code> aggregation.
			 *
			 * @param aArgs {array}
			 * @param bIsAdding {boolean}
			 * @returns {sap.m.TabStrip} <code>this</code> instance for chaining
			 */
			handleItemsAggregation: function (aArgs, bIsAdding) {
				var sAggregationName = 'items', // name of the aggregation in TabStripSelect
					sFunctionName = aArgs[0],
					oObject = aArgs[1],
					aNewArgs = [sAggregationName];

				/* remove the function name from the args array */
				aArgs.forEach(function (iItem, iIndex) {
					if (iIndex > 0) {
						aNewArgs.push(iItem);
					}
				});

				if (bIsAdding) {
					// attach and detach (or only detach if not adding) event listeners for the item
					oEventsHelper.attachItemEventListeners.call(this, oObject);
				} else {
					oEventsHelper.detachItemEventListeners.call(this, oObject);
				}

				// no need to handle anything else for other aggregations than 'items'
				if (sAggregationName !== "items") {
					return this;
				}

				if (this.getHasSelect()) {
					oAggregationsHelper.handleSelectItemsAggregation.call(this, aNewArgs,  bIsAdding, sFunctionName, oObject);
				}
				return this;
			},
			/**
			 * Ensures proper handling of <code>TabStrip</code> <code>items</code> aggregation and proxies to the <code>TabStripSelect</code> <code>items</code> aggregation.
			 *
			 * @param aArgs {array}
			 * @param bIsAdding {boolean}
			 * @param sFunctionName {string}
			 * @param oObject {object}
			 * @returns {*}
			 */
			handleSelectItemsAggregation: function (aArgs, bIsAdding, sFunctionName, oObject) {
				var oSelect             = this.getAggregation('_select'),
				    oDerivedObject;     // a new instance, holding a copy of the TabStripItem which is given to the TabStripSelect instance

				if (sFunctionName === 'destroyAggregation' && !oSelect) {
					/* ToDo : For some reason aggregation _select may be already deleted (e.g. TabStrip.destroy will destroy all children including _select */
					return;
				}
				// ToDo: test this functionality
				// destroyAggregation and removeAllAggregation no not need oObject, action can be directly taken
				if (oObject === null || typeof oObject !== 'object') {
					return oSelect[sFunctionName]['apply'](oSelect, aArgs);
				}


				if (bIsAdding) {
					oDerivedObject = oAggregationsHelper.createSelectItemFromTabStripItem.call(this, oObject);
				} else {
					oDerivedObject = oAggregationsHelper.findSelectItemFromTabStripItem.call(this, oObject);
				}

				// substitute the TabStrip item instance with the TabStripSelectItem instance
				aArgs.forEach(function (iItem, iIndex) {
					if (typeof iItem === 'object') {
						aArgs[iIndex] = oDerivedObject;
					}
				});

				return oSelect[sFunctionName]['apply'](oSelect, aArgs);
			},
			/**
			 * Creates <code>TabStripItem</code> in context of <code>TabStripSelect</code>.
			 *
			 * @param oSelect
			 * @param aItems
			 */
			addItemsToSelect: function (oSelect, aItems) {
				aItems.forEach(function (oItem) {
					var oSelectItem = oAggregationsHelper.createSelectItemFromTabStripItem.call(this, oItem);
					oSelect.addAggregation('items', oSelectItem);

					// make sure to set the correct select item
					if (oItem.getId() === this.getSelectedItem()) {
						oSelect.setSelectedItem(oSelectItem);
					}
				}, this);
			},
			/**
			 * Ensures proper <code>TabStripItem</code> inheritance in context of <code>TabStripSelect</code>.
			 *
			 * @param oTabStripItem {sap.m.TabStripItem}
			 * @returns {sap.ui.core.Element}
			 */
			createSelectItemFromTabStripItem: function (oTabStripItem) {
				if (!oTabStripItem) {
					return; // ToDo: sap log error ?
				}
				var sType = oTabStripItem.getMetadata().getName();

				// ToDo: change this to 'sap.m.TabContainerItem' when the new type gets created
				if (sType !== 'sap.m.TabStripItem' /*'sap.m.TabContainerItem'*/) {
					jQuery.sap.log.error('Expecting instance of "sap.m.TabContainerItem": ' + sType + ' given.');
					return;
				}

				var oSelectItem = new sap.m.TabStripItem({
					// ToDo: must be suffix
					id             : TabStrip.SELECT_ITEMS_ID_PREFIX + oTabStripItem.getId(),
					text           : oTabStripItem.getText(),
					modified       : oTabStripItem.getModified(),
					itemClosePressed: function (oEvent) {
						oEventsHelper.handleItemClosePressed.call(this, oEvent);
					}.bind(this)
				}).addEventDelegate({
					ontap: function (oEvent) {
						var oTarget = oEvent.srcControl;
						if (oTarget instanceof AccButton) {
							oTarget.fireItemClosePressed({item: oTarget});
						} else if (oTarget instanceof sap.ui.core.Icon) {
							oTarget = oTarget.getParent && oTarget.getParent().getParent && oTarget.getParent().getParent();
							oTarget.fireItemClosePressed({item: oTarget});
						} else if (oTarget instanceof TabStripItem) {
							oTarget.fireTabSelected({item: oTarget});
						}
					}
				});

				return oSelectItem;
			},
			/**
			 * Finds the correct <code>TabStripItem</code> in context of <code>TabStrip</code> by a given <code>TabStripItem</code> instance.
			 *
			 * @param oTabStripSelectItem {sap.m.TabStripItem} The <code>TabStripItem</code> instance which analogue is to be found
			 * @returns {sap.m.TabStripItem} The <code>TabStripItem</code> in context of <code>TabStripSelect</code> found (if any)
			 */
			findTabStripItemFromSelectItem: function (oTabStripSelectItem) {
				var i,
				    sTabStripItemId = oTabStripSelectItem.getId().replace(TabStrip.SELECT_ITEMS_ID_PREFIX , ''),
				    aTabStripItems = this.getItems();
				for (i = 0; i < aTabStripItems.length; i++) {
					if (aTabStripItems[i].getId() === sTabStripItemId) {
						return aTabStripItems[i];
					}
				}
			},
			/**
			 * Finds the correct <code>TabStripItem</code> in context of <code>TabStripSelect</code> by a given <code>TabStripItem</code> instance.
			 *
			 * @param oTabStripItem {sap.m.TabStripItem} The <code>TabStripItem</code> instance which analogue is to be found
			 * @returns {sap.m.TabStripItem} The <code>TabStripItem</code> in context of <code>TabStripSelect</code> found (if any)
			 */
			findSelectItemFromTabStripItem: function (oTabStripItem) {
				var i,
				    aSelectItems,
				    sSelectItemId = TabStrip.SELECT_ITEMS_ID_PREFIX + oTabStripItem.getId();

				if (this.getHasSelect()) {
					aSelectItems = this.getAggregation('_select').getItems();

					for (i = 0; i < aSelectItems.length; i++) {
						if (aSelectItems[i].getId() === sSelectItemId) {
							return aSelectItems[i];
						}
					}
				}
			}
		};

		/**
		 * <code>TabStripItem</code> states translations
		 * ToDo: move these declarations on top
		 * @enum
		 * @type {{closable: sap.ui.core.InvisibleControl, modified: sap.ui.core.InvisibleControl, notModified: sap.ui.core.InvisibleControl}}
		 * @private
		 */
		TabStrip._ariaStaticTexts = {
			/**
			 * Holds the static text for "Closable" item that should be read by screen reader
			 */
			closable: new InvisibleText({text: oRb.getText("TABSTRIP_ITEM_CLOSABLE")}).toStatic(),
			/**
			 * Holds the static text for "Unsaved" item that should be read by screen reader
			 */
			modified: new InvisibleText({text: oRb.getText("TABSTRIP_ITEM_MODIFIED")}).toStatic(),
			/**
			 * Holds the static text for "Saved" item that should be read by screen reader
			 */
			notModified:  new InvisibleText({text: oRb.getText("TABSTRIP_ITEM_NOT_MODIFIED")}).toStatic()
		};

		/**
		 * Handles ARIA-selected attributes depending on the currently selected item.
		 * ToDo: [Refactoring] Consider adding this method in TabStrip.prototype
		 * @param aItems {Array.<sap.m.TabStripItem>} The whole set of items
		 * @param oSelectedItem {sap.m.TabStripItem} Currently selected item
		 * @private
		 */
		function updateAriaSelectedAttributes(aItems, oSelectedItem) {
			var sAriaSelected = "false";
			aItems.forEach(function (oItem) {
				if (oItem.$()) {
					sAriaSelected = "false";
					if (oSelectedItem && oSelectedItem.getId() === oItem.getId()) {
						sAriaSelected = "true";
					}
					oItem.$().attr("aria-selected", sAriaSelected);
				}
			});
		}

		/**
		 * Handles the proper update of the <code>TabStripItem</code> selection class.
		 * ToDo: [Refactoring] Consider adding this method in TabStrip.prototype
		 * @param sSelectedItemId
		 */
		function updateSelectedItemClasses(sSelectedItemId) {
			if (this.$("tabs")) {
				this.$("tabs").children(".selected").removeClass("selected");
				jQuery("#" + sSelectedItemId).addClass("selected");
			}
		}

		/**
		 * ToDo: This method doesn't work because the rendering works with ::after pseudo element - better to alter the
		 * renderer, so this logic would work the same way for the select item and tabstrip item. */

		/**
		 * Changes the visibility of the item "state" symbol.
		 * @param {mixed} vItemId
		 * @param {boolean} bShowState
		 */
		TabStrip.prototype.changeItemState = function(vItemId, bShowState) {
			// ToDo: remove this hack !? - for some reason otherwise these are 'undefined' - can it be the lazy loading?
			TabStripItem.CSS_CLASS_STATE            = "sapMTabStripSelectListItemModified";
			TabStripItem.CSS_CLASS_STATEINVISIBLE   = "sapMTabStripSelectListItemModifiedInvisible";
			TabStripItem._CSS_CLASS_LABEL           = "sapMTabContainerItemLabel";
			// ToDo: fix mess and remove hilarious constant
			TabStripItem.YET_ANOTHER_CSS_CLASS_FOR_THE_SAME_THING_THAT_LOST_ME_20_MINUTES_IN_CONFUSION = "sapMTabContainerItemModified";


			var $oItemState;

			// optimisation to not invalidate and rerender the whole parent DOM, but only manipulate the CSS class
			// for invisibility on the concrete DOM element that needs to change
			var aItems = this.getItems();
			aItems.forEach(function (oItem) {
				if (vItemId === oItem.getId()) {
					$oItemState = jQuery(oItem.$());
					if (bShowState === true && !$oItemState.hasClass(TabStripItem.YET_ANOTHER_CSS_CLASS_FOR_THE_SAME_THING_THAT_LOST_ME_20_MINUTES_IN_CONFUSION)) {
						$oItemState.addClass(TabStripItem.YET_ANOTHER_CSS_CLASS_FOR_THE_SAME_THING_THAT_LOST_ME_20_MINUTES_IN_CONFUSION);
					} else {
						$oItemState.removeClass(TabStripItem.YET_ANOTHER_CSS_CLASS_FOR_THE_SAME_THING_THAT_LOST_ME_20_MINUTES_IN_CONFUSION);
					}
				}
			});
		};

		/**
		 * Handles the <code>onTouchStart</code> event.
		 * @param oEvent {jQuery.event} Event object
		 * @returns {boolean}
		 */
		TabStrip.prototype.ontouchstart = function (oEvent) {
			var oTargetItem = jQuery(oEvent.target).control(0);
			if (oTargetItem instanceof TabStripItem ||
				oTargetItem instanceof AccButton ||
				oTargetItem instanceof sap.ui.core.Icon ||
				oTargetItem instanceof TabStripSelect) {
				// Support only single touch
				// Store the pageX coordinate for for later usage in touchend
				this._oTouchStartX = oEvent.changedTouches[0].pageX;
			}
		};

		/**
		 * Handles the <code>onTouchEnd</code> event.
		 * @param oEvent {jQuery.event} Event object
		 * @returns {boolean}
		 */
		TabStrip.prototype.ontouchend = function (oEvent) {
			var oTarget,
				iDeltaX;

			if (!this._oTouchStartX) {
				return;
			}

			oTarget = jQuery(oEvent.target).control(0);
			// Support only single touch
			iDeltaX = Math.abs(oEvent.changedTouches[0].pageX - this._oTouchStartX);

			if (iDeltaX < TabStrip._MINDRAGOFFSET) {
				if (oTarget instanceof TabStripItem) {
					// TabStripItem clicked
					this._activateItem(oTarget);
				} else if (oTarget instanceof sap.m.AccButton) {
					// TabStripItem close button clicked
					if (oTarget && oTarget.getParent && oTarget.getParent() instanceof TabStripItem) {
						oTarget = oTarget.getParent();
						this._removeItem(oTarget);
					}
				} else if (oTarget instanceof sap.ui.core.Icon) {
					// TabStripItem close button icon clicked
					if (oTarget && oTarget.getParent && oTarget.getParent().getParent && oTarget.getParent().getParent() instanceof TabStripItem) {
						oTarget = oTarget.getParent().getParent();
						this._removeItem(oTarget);
					}
				}
				// Not needed anymore
				this._oTouchStartX = null;
			}
		};

		return TabStrip;

	}, /* bExport= */ false);
