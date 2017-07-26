# AppRecom - Location based app recommendation algorithm.

AppRecom is a module that can be dropped into any JavaScript project.

## Install

`npm install apprecom`

## Methods

This system uses records from location-app relationships to predict the best app categories to recommend for a location.

The two main methods are:

```javascript
// Trains the system on your data
train(data, min_support, min_conf, testRatio)

// Gets the app category recommendations for location
// (after being trained)
getApps(location)
```

Check out the documentation for more information [here](http://patrickeddy.github.io/apprecom/AppRecom.html).

## Implementation

Check out [ARI - an AppRecom CLI implementation](https://github.com/patrickeddy/ari) or the [AppRecom Demo Android App](https://drive.google.com/open?id=0B5Y3QFf8MTMzMmdWWDFKbmFyMGs).
