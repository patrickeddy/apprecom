# AppRecom - Location based app recommendation system.

AppRecom is a module that can be dropped into any JavaScript project.

This system uses records from location-app relationships to predict the best app categories to recommend for a location.

The two main methods are:

```javascript
// Trains the system on your data
train(data, min_support, min_conf)

// Gets the app category recommendations for location
// (after being trained)
getApps(location)
```

[Check out the documentation for more information here.](http://patrickeddy.github.io/apprecom/AppRecom.html)