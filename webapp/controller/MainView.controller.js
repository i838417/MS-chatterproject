sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",

],
    function (Controller, MessageToast, MessageBox) {
        "use strict";

        return Controller.extend("hzns.chatterproject.controller.MainView", {
            onInit: function () {
                this._router = sap.ui.core.UIComponent.getRouterFor(this);
                this._router.getTarget("TargetMainView").attachDisplay(this.handleRouteMatched, this);
            },
            handleRouteMatched: function (event) {
                let usrModel = new sap.ui.model.json.JSONModel();
                usrModel.loadData(this.getAppModulePath() + "/user-api/currentUser", null, false, "GET", false, null, { "Content-Type": "application/json" });
                this.getView().setModel(usrModel, "UserInfo");
                let dt = new Date();
                this.getView().byId("idSinceDate").setValue(new Date(dt.getFullYear + "-" + (dt.getMonth()+1) + "-" + dt.getDate()));

                this.loadMessages();
                
                let that = this;
                setInterval(function() {
                    try {
                        that.refreshTableData(that);
                    }
                    catch(error) {
                        console.log("Error when  polling responses: ");
                        console.log(error);
                    }
                }, 2500);
            
            },
            loadMessages: function () {
                let userId = this.getView().getModel("UserInfo").getData().email;

                let sUrl = this.getAppModulePath() + "/sap/CollaborationHistory?$filter=ToUserId%20eq%20%27" + userId + "%27";
                let messagesModel = new sap.ui.model.json.JSONModel();
                messagesModel.loadData(sUrl, null, false, "GET", false, null, { "Content-Type": "application/json" });

                let normTblContent = this.normalizeTableContent(messagesModel, this);
                this.getView().setModel(new sap.ui.model.json.JSONModel({value: normTblContent}), "ProjectsModel")
            },
            getAppModulePath: function () {
                var appId = this.getOwnerComponent().getManifestEntry("/sap.app/id");
                var appPath = appId.replaceAll(".", "/");
                // @ts-ignore
                var appModulePath = jQuery.sap.getModulePath(appPath);

                return appModulePath;
            },
            onPressRowItem: function(oEvent) {
                let bindingContext = oEvent.getSource().getBindingContext("ProjectsModel");
                let path = bindingContext.getPath();
                let projectsListModel = bindingContext.getModel().getData();
                let selectedIndex = path.split("/")[2];
                let selectedRow = projectsListModel.value[selectedIndex];

                this.getView().byId("ProjectID").setValue(selectedRow.ProjectId);

                let sUrl = this.getAppModulePath() + "/sap/CollaborationHistory?$filter=ProjectId%20eq%20%27" + selectedRow.ProjectId + "%27";
                let oMsgModel = new sap.ui.model.json.JSONModel();
                oMsgModel.loadData(sUrl, null, false, "GET", false, null, { "Content-Type": "application/json" });

                let msgHistory = "";
                for( let i=0; i<oMsgModel.getData().value.length; i++) {
                    msgHistory = msgHistory + "--> At Step: " + oMsgModel.getData().value[i].StepId + 
                                              "; From: " + oMsgModel.getData().value[i].FromUserId + 
                                              "; At Time: " + oMsgModel.getData().value[i].createdAt + 
                                              "; Message: \n" + oMsgModel.getData().value[i].Message + "\n";
                }

                this.getView().byId("idInMessage").setValue(msgHistory);

                this.CURREMT_ROW = selectedRow;
                this.getView().byId("idMyMessage").focus();
            },
            onPostMessage: function(oEvent) {
                if( ! this.CURREMT_ROW) {
                    MessageBox.error("Please select a project entry to post message to");
                    return;
                 }

                 if( this.getView().byId("idMyMessage").getValue().length == 0) {
                    MessageBox.error("Cannot post blank message");
                    return;
                 }

                let oMsgModel = new sap.ui.model.json.JSONModel();

                let payload = {
                    "ProjectId": this.CURREMT_ROW.ProjectId,
                    "WorkflowInstanceId": this.CURREMT_ROW.WorkflowInstanceId,
                    "StepId": this.CURREMT_ROW.StepId,
                    "FromUserId": this.getView().getModel("UserInfo").getData().email,
                    "ToUserId": this.CURREMT_ROW.FromUserId,
                    "Message": this.getView().byId("idMyMessage").getValue()
                }
                oMsgModel.loadData(this.getAppModulePath() + "/sap/CollaborationHistory", JSON.stringify(payload), false, "POST", false, null, { "Content-Type": "application/json" });
                this.loadMessages();
                this.CURREMT_ROW = null;
                this.getView().byId("ProjectID").setValue("");
                this.getView().byId("idInMessage").setValue("");
                this.getView().byId("idMyMessage").setValue("");
                MessageToast.show("Message posted.");
            },

            refreshTableData: async function(that) {
                let userId = this.getView().getModel("UserInfo").getData().email;
                let sUrl = this.getAppModulePath() + "/sap/CollaborationHistory?$filter=ToUserId%20eq%20%27" + userId + "%27";
                let messagesModel = new sap.ui.model.json.JSONModel();
                messagesModel.attachRequestCompleted(function () {
                    let normTblContent = that.normalizeTableContent(messagesModel, that);
                    that.getView().setModel(new sap.ui.model.json.JSONModel({value: normTblContent}), "ProjectsModel")
                });
                messagesModel.loadData(sUrl, null, true, "GET", false, null, { "Content-Type": "application/json" });
            },
            normalizeTableContent: function(allData, that) {
                let projectsMap = new Map();
                let records = allData.getData().value;
                if( ! records ) {
                    return [];
                }

                for (let i = 0; i < records.length; i++) {
                    if( projectsMap.get(records[i].ProjectId)) {
                        let et = new Date(projectsMap.get(records[i].ProjectId).createdAt);
                        let ct = new Date(records[i].createdAt);
                        if( ct > et) {
                            projectsMap.set(records[i].ProjectId, records[i]);
                        }
                    }
                    else {
                        let ft = new Date(that.getView().byId("idSinceDate").getValue());
                        let rt = new Date(records[i].createdAt);
                        if( rt >= ft ) {
                            projectsMap.set(records[i].ProjectId, records[i]);
                        }
                    }
                }       

                let ki = projectsMap.keys();
                let projectChats = [];

                for (; ;) {
                    let projChatK = ki.next().value;
                    if( ! projChatK ) {
                        break;
                    }

                    projectChats.push(projectsMap.get(projChatK));
                  }
             
                projectChats.sort((a, b) => {
                    let da = new Date(a.createdAt)
                    let db = new Date(b.createdAt);
                    if( da> db ) {
                        return -1
                    }
                    else {
                        return 1;
                    }
                });

                return projectChats;
            }
        });
    });
