/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"hzns/chatterproject/test/unit/AllTests"
	], function () {
		QUnit.start();
	});
});
