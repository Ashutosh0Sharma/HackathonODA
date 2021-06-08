"use strict";

let config = require("../config");
let request = require("request");

let https = require('https')

let fs = require("fs");


class NearestParkingDetails {
    metadata() {
        return {
            "name": "getNear",
            "properties": {
                "xCoordinate": {
                    "type": "string",
                    "required": true
                },
                "yCoordinate": {
                    "type": "string",
                    "required": true
                },
                "carType": {
                    "type": "string",
                    "required": true
                },
                "placeName": {
                    "type": "string",
                    "required": true
                }


            },
            "supportedActions": [
                "BookingSuccess", "BookingFailure"
            ]
        }
    }

    invoke(conversation, done) {
        //storing the inputs from chatbot user
        let xCoordinate = conversation.properties().xCoordinate;
        let yCoordinate = conversation.properties().yCoordinate;
        let carType = conversation.properties().carType;
        let placeName = conversation.properties().placeName;
 
        let checkIn = new Date(conversation.variable("selectedDate")).toLocaleString()
        let checkOut = conversation.variable("selectedDate1") ? new Date(conversation.variable("selectedDate1")).toLocaleString() : ""


        let durt, height;
        
        //Getting API url from config
        let url = config.CUSTOMER.GetParkingUrl;

        console.log(url)
        // Storing height of vehicle according to car type
        if (carType == "SUV") {
            height = 2.5;
        }
        else {
            height = 2;
        }

        // If User wants to find parking according to place Name; modify URL
        if (placeName != "${location.value}") {
            url = url + "&q=" + placeName;
        }

        // Creating  a request for API call
        let options = {
            url: url,
            method: 'GET',

        };

        // function callback called after getting the response from API after line
        function callback(error, response, body) {


            // If Status code is 200 i.e response received and no error execute this if block
            if (!error && response.statusCode == 200) {
                var parkingDetails = body;
                var filtered, count = 0, distanceArray = [];

                parkingDetails = JSON.parse(parkingDetails);
                parkingDetails = parkingDetails.result.records;
                console.log(parkingDetails);
                let parkDetailsArr = [];
                // Execution for search by place name
                if (placeName != "${location.value}") {
                    
                    for (let i = 0; i < parkingDetails.length; i++) {
                        // Validate user car Type can fit according to Gantry Height mentioned by parking areas
                        if ((parkingDetails[i].gantry_height >= height)) {


                            count++;
                            console.log(count);
                            // Push The details for "search by name" in parkdetailsArr to pass to chatbot
                            parkDetailsArr.push({
                                title: parkingDetails[i].address.toString(),
                                description: "\nCar Park Number: " + parkingDetails[i].car_park_no.toString() +
                                    "\nCar Park Type: " + parkingDetails[i].car_park_type.toString() +
                                    "\nType of Parking System: " + parkingDetails[i].type_of_parking_system.toString()

                            })

                        }
                    }
                }
                // Find nearest according to chatbot user's nearest latitude and longitude
                else {

                    for (let i = 0; i < parkingDetails.length; i++) {
                        // Validate user car Type can fit according to Gantry Height mentioned by parking areas
                        if ((parkingDetails[i].gantry_height >= height)) {

                            count++;
                            // Haversine algorithm calculation to find distance from parking spot and chatbot User
                            var lat2 = yCoordinate;
                            var lon2 = xCoordinate;
                            var lat1 = parkingDetails[i].y_coord;
                            var lon1 = parkingDetails[i].x_coord;

                            var R = 6371; // km 

                            var x1 = lat2 - lat1;
                            var dLat = x1 * Math.PI / 180;
                            var x2 = lon2 - lon1;
                            var dLon = x2 * Math.PI / 180;
                            var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                                Math.sin(dLon / 2) * Math.sin(dLon / 2);
                            var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                            var d = R * c;

                            // Push distance from client and all parameters of parking area in distanceArray
                            distanceArray.push({
                                srNo: i,
                                distance: d,
                                address: parkingDetails[i].address.toString(),
                                carParkNo: parkingDetails[i].car_park_no.toString(),
                                carParkType: parkingDetails[i].car_park_type.toString(),
                                typeParkingSystem: parkingDetails[i].type_of_parking_system.toString()
                            })


                        }
                        // Sort the distanceArray in ascending order 
                        // First position in details will be nearest from users location and increasing so on.
                    }
                    distanceArray.sort(function (a, b) {
                        return a.distance - b.distance;
                    });
                    // Push The Nearest parking location array in parkdetailsArr to pass to chatbot
                    for (let i = 0; i < distanceArray.length; i++) {
                        parkDetailsArr.push({
                            title: distanceArray[i].address.toString(),
                            description: "\nCar Park Number: " + distanceArray[i].carParkNo.toString() +
                                "\nCar Park Type: " + distanceArray[i].carParkType.toString() +
                                "\nType of Parking System: " + distanceArray[i].typeParkingSystem.toString()
                        })
                    }

                }

                // If Parking spots have been found for User
                if (count != 0) {

                    //Pass These variables to chatbot
                    conversation.variable("ParkingDetails", parkDetailsArr) // Nearest parking details array
                    conversation.variable("checkIn", checkIn)   
                    conversation.variable("checkOut", checkOut)



                    conversation.keepTurn(true)
                    conversation.transition("BookingSuccess");

                    done();
                }
                // If Parking spots have not been found for User
                else {
                    conversation.transition("BookingFailure");
                    conversation.keepTurn(true)

                    done();
                }


            }
            // if status code is not 200 or and error in API call execute this
            else {
                conversation.reply("Oops! There is some technical issue at the backend. Please try again later.")
                conversation.keepTurn(true)

                done();
            }
        }

        // API call to get data of all parking Areas in singapore
        request(options, callback)
    }

}

module.exports = new NearestParkingDetails();